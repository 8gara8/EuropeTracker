import { run, type RunResult } from "./run";

// Git through child processes. Never prompts: GIT_TERMINAL_PROMPT=0 makes a missing credential fail
// fast instead of hanging an unattended run. A deadline caps every command's timeout, so publishing
// can't run past the hard stop.

export class GitError extends Error {}

/** Main can't be brought up to date automatically; retrying won't help. */
export class SyncError extends GitError {}

export interface Git {
  (args: string[], timeoutMs?: number): Promise<string>;
  cwd: string;
  deadline: number | null;
}

export function git(cwd: string, opts: { deadline?: number } = {}): Git {
  const deadline = opts.deadline ?? null;
  const fn = (async (args: string[], timeoutMs = 60_000) => {
    const ms = deadline === null ? timeoutMs : Math.min(timeoutMs, deadline - Date.now());
    if (ms <= 0) throw new GitError(`git ${args[0]} not started: the run's deadline has passed.`);
    const r: RunResult = await run("git", args, { cwd, timeoutMs: ms, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    if (r.code !== 0) throw new GitError(`git ${args.join(" ")} failed (${r.timedOut ? "timeout" : `exit ${r.code}`}): ${r.stderr.trim().slice(0, 400)}`);
    return r.stdout.trim();
  }) as Git;
  fn.cwd = cwd;
  fn.deadline = deadline;
  return fn;
}

export async function isClean(g: Git): Promise<boolean> {
  return (await g(["status", "--porcelain"])) === "";
}

/** Runs `fn`, retrying after each delay unless the error is fatal or the next try would start past the deadline. */
export async function withRetry<T>(fn: () => Promise<T>, delays: number[], deadline: number | null, fatal: (e: unknown) => boolean = () => false): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (fatal(e)) throw e;
      last = e;
      const wait = delays[attempt];
      if (wait === undefined || (deadline !== null && Date.now() + wait >= deadline)) break;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

/** Pushes with retries at 2 s, 4 s and 8 s (SPEC §7.6). */
export async function pushWithRetry(g: Git, args: string[], delays = [2_000, 4_000, 8_000]): Promise<void> {
  await withRetry(() => g(["push", ...args], 120_000), delays, g.deadline);
}

/**
 * Brings the checked-out main up to date with GitHub's (SPEC §7.6). Commits only this clone has must
 * be briefs, touching content/ alone: they are rebased onto origin/main, so a brief whose push failed
 * goes out with the next push. `moved` is true when they now sit on newer commits from GitHub.
 */
export async function syncMain(g: Git): Promise<{ ahead: number; moved: boolean }> {
  await g(["fetch", "origin", "main"], 60_000);
  const ahead = (await g(["rev-list", "origin/main..HEAD"])).split("\n").filter(Boolean).length;
  if (ahead) {
    const other = (await g(["diff", "--name-only", "origin/main...HEAD"])).split("\n").filter((f) => f && !f.startsWith("content/"));
    if (other.length) {
      throw new SyncError(`main has ${ahead} commit(s) GitHub lacks that touch ${other.slice(0, 3).join(", ")}; only briefs (content/) are pushed automatically. Push or drop them by hand.`);
    }
  }
  const before = await g(["rev-parse", "HEAD"]);
  try {
    await g(["rebase", "origin/main"]);
  } catch (e) {
    await g(["rebase", "--abort"]).catch(() => {});
    throw new SyncError(`Couldn't put main's unpushed briefs on top of GitHub's main: ${(e as Error).message}`);
  }
  return { ahead, moved: ahead > 0 && (await g(["rev-parse", "HEAD"])) !== before };
}

/** Whether origin/main, as last fetched, has `file`. */
export async function onOrigin(g: Git, file: string): Promise<boolean> {
  return g(["cat-file", "-e", `origin/main:${file}`]).then(() => true, () => false);
}
