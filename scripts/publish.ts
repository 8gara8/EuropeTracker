// Publish a validated draft (SPEC §7.6).
//   tsx scripts/publish.ts --date YYYY-MM-DD [--review]
// Validates drafts/DATE.json in full, applies it to content/, re-validates the whole folder, writes the
// files with a stable key order, commits "brief: DATE — <title>" and pushes to main (or to a new
// review/DATE branch with --review). daily.ts calls publish() directly with its in-memory context.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { applyDraft, type Applied } from "../lib/apply";
import { loadContent } from "../lib/content";
import { buildContext } from "../lib/context";
import { Brief } from "../lib/schema/brief";
import type { AgentContext } from "../lib/schema/context";
import { ForecastsFile } from "../lib/schema/forecast";
import { IncidentsFile } from "../lib/schema/incident";
import { ArchiveIndex, EvidenceFile } from "../lib/schema/misc";
import { State } from "../lib/schema/state";
import { StrikesFile } from "../lib/schema/strike";
import { validateAll, validateDraft, type ValidationIssue } from "../lib/validate";
import { git, pushWithRetry } from "./lib/git";

export class PublishError extends Error {
  constructor(message: string, readonly errors: ValidationIssue[] = []) {
    super(message);
  }
}

export const PENDING_ARCHIVE = "logs/archive-index.pending.json";

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** "2026-11-03T06:12:34+08:00" */
export function taipeiTimestamp(now: Date): string {
  return `${new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 19)}+08:00`;
}

/** Every content file publish writes, keyed by path relative to content/, parsed through its schema for a stable key order. */
export function serialize(applied: Applied): Map<string, string> {
  const files = new Map<string, string>();
  files.set(`briefs/${applied.brief.date}.json`, json(Brief.parse(applied.brief)));
  const years = (items: { date: string }[]) => [...new Set(items.map((i) => Number(i.date.slice(0, 4))))];
  for (const year of years(applied.incidents)) {
    files.set(`incidents/${year}.json`, json(IncidentsFile.parse({ schema_version: 1, year, incidents: applied.incidents.filter((i) => i.date.startsWith(`${year}-`)) })));
  }
  for (const year of years(applied.strikes)) {
    files.set(`strikes/${year}.json`, json(StrikesFile.parse({ schema_version: 1, year, strikes: applied.strikes.filter((s) => s.date.startsWith(`${year}-`)) })));
  }
  files.set("state.json", json(State.parse(applied.state)));
  files.set("forecasts.json", json(ForecastsFile.parse({ schema_version: 1, forecasts: applied.forecasts })));
  files.set("archive-index.json", json(ArchiveIndex.parse({ schema_version: 1, urls: applied.archive })));
  return files;
}

export interface PublishOptions {
  repo: string;
  date: string;
  draft: unknown;
  /** The context the agent worked from; built from content/ when absent. */
  context?: AgentContext;
  evidence: string[] | null;
  review?: boolean;
  now?: Date;
  log?: (message: string) => void;
}

export interface PublishResult {
  brief: Brief;
  branch: string;
  commit: string;
}

export async function publish(opts: PublishOptions): Promise<PublishResult> {
  const log = opts.log ?? (() => {});
  const contentDir = path.join(opts.repo, "content");
  const content = loadContent(contentDir, { fresh: true });
  if (content.briefs.some((b) => b.date === opts.date)) throw new PublishError(`content/briefs/${opts.date}.json already exists`);

  // 1. Validate the draft in full.
  const context = opts.context ?? buildContext(content, opts.date);
  const result = validateDraft(opts.draft, {
    context,
    world: { incidents: content.incidents, strikes: content.strikes, forecasts: content.forecasts },
    evidence: opts.evidence,
    fileDate: opts.date,
  });
  if (!result.ok || !result.draft) throw new PublishError(`drafts/${opts.date}.json has ${result.errors.length} validation errors`, result.errors);

  // 2–3. Apply it, including any archive snapshots requested after the previous brief.
  const pendingFile = path.join(opts.repo, PENDING_ARCHIVE);
  const pending = fs.existsSync(pendingFile) ? ArchiveIndex.shape.urls.parse(JSON.parse(fs.readFileSync(pendingFile, "utf8"))) : {};
  const applied = applyDraft(
    { incidents: content.incidents, strikes: content.strikes, state: content.state, forecasts: content.forecasts, archive: content.archive },
    result.draft,
    { publishedAt: taipeiTimestamp(opts.now ?? new Date()), pendingArchive: pending },
  );
  const files = serialize(applied);

  // 4. Re-validate the whole folder as it would be, in a scratch copy.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "et-publish-"));
  try {
    fs.cpSync(contentDir, scratch, { recursive: true });
    for (const [rel, text] of files) {
      fs.mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
      fs.writeFileSync(path.join(scratch, rel), text);
    }
    const all = validateAll(scratch);
    if (!all.ok) throw new PublishError("The content would not validate after applying the draft", all.errors);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  // 5. Write, commit and push.
  const g = git(opts.repo);
  const branch = opts.review ? `review/${opts.date}` : "main";
  if (opts.review) await g(["checkout", "-b", branch]);
  try {
    for (const [rel, text] of files) {
      fs.mkdirSync(path.dirname(path.join(contentDir, rel)), { recursive: true });
      fs.writeFileSync(path.join(contentDir, rel), text);
    }
    await g(["add", "content/"]);
    await g(["commit", "-m", `brief: ${opts.date} — ${applied.brief.title}`]);
    const commit = await g(["rev-parse", "HEAD"]);
    log(`Committed ${commit.slice(0, 7)} on ${branch}; pushing.`);
    await pushWithRetry(g, opts.review ? ["-u", "origin", branch] : ["origin", "main"]);
    if (fs.existsSync(pendingFile)) fs.rmSync(pendingFile);
    return { brief: applied.brief, branch, commit };
  } finally {
    if (opts.review) await g(["checkout", "main"]).catch(() => {});
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { date: { type: "string" }, review: { type: "boolean" } } });
  if (!values.date) {
    console.error("Usage: npm run publish -- --date YYYY-MM-DD [--review]");
    return 2;
  }
  const draftFile = `drafts/${values.date}.json`;
  const evidenceFile = `logs/${values.date}.evidence.json`;
  const draft = JSON.parse(fs.readFileSync(draftFile, "utf8"));
  const evidence = fs.existsSync(evidenceFile) ? EvidenceFile.parse(JSON.parse(fs.readFileSync(evidenceFile, "utf8"))).urls : null;
  if (!evidence) console.log(`No ${evidenceFile}: cited URLs won't be checked against the agent's evidence.`);
  try {
    const r = await publish({ repo: process.cwd(), date: values.date, draft, evidence, review: values.review, log: console.log });
    console.log(`Published ${values.date} on ${r.branch} (${r.commit.slice(0, 7)}): ${r.brief.title}`);
    return 0;
  } catch (e) {
    console.error((e as Error).message);
    for (const err of (e as PublishError).errors ?? []) console.error(`  ${err.code} ${err.path}: ${err.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; });
}
