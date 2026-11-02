// Supervised mode (SPEC §7.6): after JL approves the review/DATE preview, move it onto main.
//   tsx scripts/promote.ts --date YYYY-MM-DD

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { git, isClean, pushWithRetry } from "./lib/git";

export async function promote(repo: string, date: string, log: (m: string) => void = () => {}): Promise<void> {
  const g = git(repo);
  const branch = `review/${date}`;
  if (!(await isClean(g))) throw new Error("The working tree has uncommitted changes; commit or stash them first.");
  await g(["fetch", "origin", "main", branch]);
  await g(["checkout", "main"]);
  await g(["merge", "--ff-only", "origin/main"]);
  await g(["merge", "--ff-only", `origin/${branch}`]);
  await pushWithRetry(g, ["origin", "main"]);
  log(`main now includes ${branch}; deleting the branch.`);
  await g(["branch", "-D", branch]).catch(() => {});
  await g(["push", "origin", "--delete", branch]).catch(() => {});
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { date: { type: "string" } } });
  if (!values.date) {
    console.error("Usage: npm run promote -- --date YYYY-MM-DD");
    return 2;
  }
  try {
    await promote(process.cwd(), values.date, console.log);
    console.log(`Promoted ${values.date}. Vercel deploys main in about a minute.`);
    return 0;
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; });
}
