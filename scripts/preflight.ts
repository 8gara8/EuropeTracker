import fs from "node:fs";
import path from "node:path";
import { git, isClean, type Git } from "./lib/git";
import { CLAUDE_TOKEN_SERVICE, readSecret } from "./lib/keychain";
import { acquireLock } from "./lib/lock";

// Preflight (SPEC §7.2 step 1). Every check either passes or ends the run with a code; "skip" ends it
// quietly (another run holds the lock, or today's brief already exists).

export type PreflightResult =
  | { status: "ok"; token: string; notes: string[] }
  | { status: "skip"; reason: string }
  | { status: "fail"; code: "E_ARCH" | "E_LOCK" | "E_NET" | "E_GIT" | "E_AUTH"; message: string };

export interface PreflightOptions {
  repo: string;
  date: string;
  force: boolean;
  /** Dry runs make no git writes: no checkout or pull, and uncommitted changes are allowed. */
  dryRun?: boolean;
  claudeBin: string;
  lockFile: string;
  /** Read the token; injectable for tests. */
  readToken?: () => string | null;
  fetchImpl?: typeof fetch;
  arch?: string;
}

export async function preflight(o: PreflightOptions): Promise<PreflightResult> {
  const notes: string[] = [];
  const arch = o.arch ?? process.arch;
  if (arch !== "arm64") return { status: "fail", code: "E_ARCH", message: `Node is running as ${arch}; use the native /opt/homebrew/bin/node (arm64).` };

  const lock = acquireLock(o.lockFile);
  if (!lock.acquired) return { status: "skip", reason: `Another run (pid ${lock.holder.pid}, started ${lock.holder.started}) is in progress.` };
  if (lock.replacedStale) notes.push(`Removed a stale lock (${lock.replacedStale}).`);

  try {
    const res = await (o.fetchImpl ?? fetch)("https://github.com", { method: "HEAD", signal: AbortSignal.timeout(10_000) });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    return { status: "fail", code: "E_NET", message: `No network: github.com did not answer within 10 s (${(e as Error).message}).` };
  }

  const g: Git = git(o.repo);
  try {
    if (!(await isClean(g))) {
      if (!o.dryRun) return { status: "fail", code: "E_GIT", message: "The repo has uncommitted changes; the pipeline only runs on a clean tree." };
      notes.push("Uncommitted changes in the repo (allowed for a dry run).");
    }
    await g(["ls-remote", "--heads", "origin", "main"], 30_000);
    if (!o.dryRun) {
      await g(["checkout", "main"]);
      await g(["pull", "--ff-only"], 60_000);
    }
  } catch (e) {
    return { status: "fail", code: "E_GIT", message: (e as Error).message };
  }

  if (!o.force && fs.existsSync(path.join(o.repo, "content", "briefs", `${o.date}.json`))) {
    return { status: "skip", reason: `The brief for ${o.date} is already published.` };
  }

  try {
    fs.accessSync(o.claudeBin, fs.constants.X_OK);
  } catch {
    return { status: "fail", code: "E_AUTH", message: `The Claude CLI is missing at ${o.claudeBin} (SPEC §8.4).` };
  }
  const token = (o.readToken ?? (() => readSecret(CLAUDE_TOKEN_SERVICE)))();
  if (!token) return { status: "fail", code: "E_AUTH", message: `No Claude login token in the keychain (service ${CLAUDE_TOKEN_SERVICE}; SPEC §8.6).` };
  return { status: "ok", token, notes };
}
