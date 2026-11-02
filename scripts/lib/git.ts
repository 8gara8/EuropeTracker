import { run, type RunResult } from "./run";

// Git through child processes. Never prompts: GIT_TERMINAL_PROMPT=0 makes a missing credential fail
// fast instead of hanging an unattended run.

export class GitError extends Error {}

export interface Git {
  (args: string[], timeoutMs?: number): Promise<string>;
  cwd: string;
}

export function git(cwd: string): Git {
  const fn = (async (args: string[], timeoutMs = 60_000) => {
    const r: RunResult = await run("git", args, { cwd, timeoutMs, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    if (r.code !== 0) throw new GitError(`git ${args.join(" ")} failed (${r.timedOut ? "timeout" : `exit ${r.code}`}): ${r.stderr.trim().slice(0, 400)}`);
    return r.stdout.trim();
  }) as Git;
  fn.cwd = cwd;
  return fn;
}

export async function isClean(g: Git): Promise<boolean> {
  return (await g(["status", "--porcelain"])) === "";
}

/** Pushes with retries at 2 s, 4 s and 8 s (SPEC §7.6). */
export async function pushWithRetry(g: Git, args: string[], delays = [2_000, 4_000, 8_000]): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      await g(["push", ...args], 120_000);
      return;
    } catch (e) {
      last = e;
      if (attempt < delays.length) await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw last;
}
