// Validator CLI (SPEC §7.5).
//   tsx scripts/validate.ts <draft.json> [--context <context.json>] [--evidence <evidence.json>]
//                           [--pack <pack.json>] [--published] [--json]
//   tsx scripts/validate.ts --all [--json]
// Exit code: 0 ok, 1 validation errors, 2 usage or IO error.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { contentDir, loadContent } from "../lib/content";
import { buildContext } from "../lib/context";
import { isValidDate } from "../lib/dates";
import { AgentContext } from "../lib/schema/context";
import { EvidenceFile } from "../lib/schema/misc";
import { Pack } from "../lib/schema/pack";
import { validateAll, validateDraft, validatePublished, worldFromContext, type ValidationIssue, type ValidationResult, type World } from "../lib/validate";

const USAGE = `Usage:
  npm run validate -- <draft.json> [--context <context.json>] [--evidence <evidence.json>] [--pack <pack.json>] [--published] [--json]
  npm run validate:all [-- --json]`;

class UsageError extends Error {}

function readJson(file: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new UsageError(`Can't read ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new UsageError(`${file} isn't valid JSON: ${(e as Error).message}`);
  }
}

function fileDateOf(file: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(path.basename(file));
  return m && isValidDate(m[1]!) ? m[1]! : null;
}

function evidenceUrls(evidenceFile?: string, packFile?: string): string[] | null {
  if (!evidenceFile && !packFile) return null;
  const urls: string[] = [];
  if (evidenceFile) {
    const r = EvidenceFile.safeParse(readJson(evidenceFile));
    if (!r.success) throw new UsageError(`${evidenceFile} isn't an evidence file ({ "urls": [...] })`);
    urls.push(...r.data.urls);
  }
  if (packFile) {
    const r = Pack.safeParse(readJson(packFile));
    if (!r.success) throw new UsageError(`${packFile} isn't a valid source pack`);
    urls.push(...r.data.items.map((i) => i.url));
  }
  return urls;
}

function printHuman(label: string, r: ValidationResult): void {
  const status = r.ok ? "OK" : "FAILED";
  const counts = `${r.errors.length} error${r.errors.length === 1 ? "" : "s"}, ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}`;
  console.log(`${label}: ${status} (${counts})`);
  const line = (i: ValidationIssue) => `  ${i.severity.padEnd(7)} ${i.code} ${i.path}: ${i.message}${i.hint ? ` (${i.hint})` : ""}`;
  for (const i of r.errors) console.log(line(i));
  for (const i of r.warnings) console.log(line(i));
}

function run(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      all: { type: "boolean" },
      context: { type: "string" },
      evidence: { type: "string" },
      pack: { type: "string" },
      published: { type: "boolean" },
      json: { type: "boolean" },
    },
  });
  const report = (label: string, r: ValidationResult) => {
    if (values.json) console.log(JSON.stringify({ ok: r.ok, errors: r.errors, warnings: r.warnings }, null, 2));
    else printHuman(label, r);
    return r.ok ? 0 : 1;
  };

  if (values.all) {
    if (positionals.length) throw new UsageError("--all takes no file");
    const dir = contentDir();
    return report(`${dir}/ (validate:all)`, validateAll(dir));
  }

  if (positionals.length !== 1) throw new UsageError("Give exactly one draft file");
  const file = positionals[0]!;
  const data = readJson(file);
  const fileDate = fileDateOf(file);

  if (values.published) return report(file, validatePublished(data, { fileDate }));

  let context: AgentContext;
  let world: World;
  if (values.context) {
    const r = AgentContext.safeParse(readJson(values.context));
    if (!r.success) throw new UsageError(`${values.context} isn't a valid agent context: ${r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    context = r.data;
    world = worldFromContext(context);
  } else {
    const date = (data as { date?: unknown }).date;
    const runDate = typeof date === "string" && isValidDate(date) ? date : fileDate;
    if (!runDate) throw new UsageError("Can't tell the draft's date; give --context, or name the file YYYY-MM-DD.json");
    let content;
    try {
      content = loadContent(contentDir());
    } catch (e) {
      throw new UsageError(`Can't build the context: ${(e as Error).message}`);
    }
    context = buildContext(content, runDate);
    world = { incidents: content.incidents, strikes: content.strikes, forecasts: content.forecasts };
  }

  const evidence = evidenceUrls(values.evidence, values.pack);
  return report(file, validateDraft(data, { context, world, evidence, fileDate }));
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (e) {
  console.error(e instanceof UsageError || (e as { code?: string }).code?.startsWith("ERR_PARSE_ARGS") ? `${(e as Error).message}\n${USAGE}` : e);
  process.exitCode = 2;
}
