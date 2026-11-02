// Writes drafts/context.json for a date (SPEC §7.4).
//   tsx scripts/build-context.ts [--date YYYY-MM-DD] [--deadline <ISO timestamp>]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadContent } from "../lib/content";
import { buildContext } from "../lib/context";
import { taipeiToday } from "../lib/dates";
import { Pack } from "../lib/schema/pack";
import type { AgentContext } from "../lib/schema/context";

export function packInfo(repo: string, date: string): AgentContext["pack"] {
  const json = `research/packs/${date}.json`;
  const md = `research/packs/${date}.md`;
  const file = path.join(repo, json);
  if (!fs.existsSync(file)) return { md, json, degraded: true, failed_feeds: [] };
  const pack = Pack.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  return { md, json, degraded: pack.degraded, failed_feeds: pack.feeds.filter((f) => !f.ok).map((f) => f.id) };
}

export function writeContext(repo: string, context: AgentContext): string {
  const file = path.join(repo, "drafts", "context.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(context, null, 2)}\n`);
  return file;
}

function main(): number {
  const { values } = parseArgs({ options: { date: { type: "string" }, deadline: { type: "string" } } });
  const date = values.date ?? taipeiToday();
  const repo = process.cwd();
  const context = buildContext(loadContent(path.join(repo, "content")), date, { deadline: values.deadline, pack: packInfo(repo, date) });
  console.log(`Wrote ${path.relative(repo, writeContext(repo, context))} for ${date}.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
