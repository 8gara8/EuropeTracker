// Phase 4 seed builder (SPEC §9 Phase 4).
//   tsx scripts/seed-build.ts           → content/ from research/seed/*.yaml, then the tables in docs/SEED-REPORT.md
//   tsx scripts/seed-build.ts --check   → build and validate in memory; write nothing
// Ids are assigned in date order. It refuses to run once content/ holds a brief or a non-seed record:
// from go-live on, the daily pipeline owns content/ and the seed files are history.
// Exit codes: 0 ok, 1 invalid seed data, 2 refused or usage error.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";
import { z } from "zod";
import { computedRung, countryFloors, pathwayCounts } from "../lib/aggregate";
import { readRawContent } from "../lib/content";
import { incidentRecordIssues, strikeRecordIssues } from "../lib/rules/records";
import { EvidenceSource, IsoDate, ProbabilityEstimate } from "../lib/schema/common";
import { Forecast, ForecastsFile } from "../lib/schema/forecast";
import { Incident, IncidentsFile } from "../lib/schema/incident";
import { State } from "../lib/schema/state";
import { Strike, StrikesFile } from "../lib/schema/strike";
import { countWords } from "../lib/text";
import { validateAll, type ValidationIssue } from "../lib/validate";
import { COUNTRIES, PATHWAYS, RUNGS, TIER1, type PathwayId } from "../lib/vocab";

const SEED_DIR = "research/seed";
const CONTENT = "content";
const REPORT = "docs/SEED-REPORT.md";
const MARK_START = "<!-- seed-build:start -->";
const MARK_END = "<!-- seed-build:end -->";

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

// [category, outlet, title, url, published_at]
const SourceTuple = z.tuple([z.string(), z.string(), z.string(), z.string(), z.string().nullable()]);
const toSource = (t: z.infer<typeof SourceTuple>) =>
  EvidenceSource.parse({ category: t[0], outlet: t[1], title: t[2], url: t[3], published_at: t[4] });

const SeedIncident = z.strictObject({
  date: IsoDate,
  month: z.literal(true).optional(),
  where: z.string(),
  affected: z.array(z.string()).optional(),
  location: z.string().nullable().optional(),
  sea: z.string().nullable().optional(),
  type: z.string(),
  rung: z.number(),
  serious: z.boolean().optional(),
  attribution: z.number(),
  note: z.string().nullable().optional(),
  host: z.enum(["yes", "none_yet"]).optional(),
  killed: z.number().optional(),
  injured: z.number().optional(),
  hours: z.number().nullable().optional(),
  summary: z.string(),
  src: z.array(SourceTuple).min(1),
});

const SeedStrike = z.strictObject({
  date: IsoDate,
  target: z.string(),
  target_type: z.string(),
  region: z.string(),
  occupied: z.boolean().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  km: z.number().nullable().optional(),
  weapon: z.string(),
  weapon_detail: z.string().nullable().optional(),
  western: z.boolean().nullable().optional(),
  verification: z.number(),
  damage: z.string().nullable().optional(),
  effect: z.string().nullable().optional(),
  summary: z.string(),
  src: z.array(SourceTuple).min(1),
});

const SeedState = z.strictObject({
  as_of: IsoDate,
  added: IsoDate,
  next_rung_odds: ProbabilityEstimate,
  pathways: z.record(z.string(), z.strictObject({ serious_odds: ProbabilityEstimate, impact: z.number() })),
  countries: z.record(z.string(), z.strictObject({ score: z.number(), since: IsoDate })),
  indicators: z.record(z.string(), z.strictObject({
    status: z.enum(["dormant", "watch", "active"]),
    since: IsoDate,
    evidence: z.string().nullable(),
    evidence_date: IsoDate.nullable(),
  })),
});

const SeedForecast = z.strictObject({
  question: z.string(),
  resolution_criteria: z.string(),
  resolves_by: IsoDate,
  horizon: z.string(),
  pathway: z.string().nullable(),
  probability: z.number(),
  base_rate: z.number(),
  base_rate_note: z.string(),
});

class SeedError extends Error {}

function readYaml(file: string): unknown {
  return YAML.parse(fs.readFileSync(file, "utf8"));
}

function fail(where: string, issues: string[]): never {
  throw new SeedError(`${where}:\n  ${issues.join("\n  ")}`);
}

function parseList<T extends z.ZodType>(file: string, schema: T): z.infer<T>[] {
  const data = readYaml(file) ?? [];
  if (!Array.isArray(data)) fail(file, ["expected a YAML list"]);
  return data.map((item, i) => {
    const r = schema.safeParse(item);
    if (!r.success) fail(`${file} [${i}] (${(item as { date?: string }).date ?? "?"})`, r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`));
    return r.data;
  });
}

function wordCheck(where: string, field: string, text: string | null | undefined, max: number, out: string[]) {
  const n = countWords(text);
  if (n > max) out.push(`${where}: ${field} has ${n} words (max ${max})`);
}

/** Incidents from research/seed/incidents/<pathway>.yaml, with ids in date order. */
export function buildIncidents(dir: string, added: string): Incident[] {
  const drafts: { pathway: PathwayId; rec: z.infer<typeof SeedIncident>; where: string }[] = [];
  for (const pathway of PATHWAYS) {
    const file = path.join(dir, "incidents", `${pathway}.yaml`);
    if (!fs.existsSync(file)) continue;
    parseList(file, SeedIncident).forEach((rec, i) => drafts.push({ pathway, rec, where: `${file} [${i}] ${rec.date}` }));
  }
  drafts.sort((a, b) => a.rec.date.localeCompare(b.rec.date));
  const seq = new Map<number, number>();
  const problems: string[] = [];
  const out = drafts.map(({ pathway, rec, where }) => {
    const year = Number(rec.date.slice(0, 4));
    const n = (seq.get(year) ?? 0) + 1;
    seq.set(year, n);
    const killed = rec.killed ?? 0;
    const european = (COUNTRIES as readonly string[]).includes(rec.where);
    const raw = {
      id: `INC-${year}-${String(n).padStart(4, "0")}`,
      date: rec.date,
      date_precision: rec.month ? "month" : "day",
      location_country: rec.where,
      affected: rec.affected ?? (european ? [rec.where] : []),
      location: rec.location ?? null,
      sea: rec.sea ?? null,
      pathway,
      type: rec.type,
      rung: rec.rung,
      serious: rec.serious ?? (rec.rung >= 4 || killed > 0),
      summary: rec.summary.trim(),
      attribution: rec.attribution,
      attribution_note: rec.note?.trim() ?? null,
      host_statement: rec.host ?? "yes",
      casualties: { killed, injured: rec.injured ?? 0 },
      disruption_hours: rec.hours ?? null,
      sources: rec.src.map(toSource),
      seed: true,
      added,
      updated: null,
    };
    const parsed = Incident.safeParse(raw);
    if (!parsed.success) {
      problems.push(...parsed.error.issues.map((x) => `${where}: ${x.path.join(".")}: ${x.message}`));
      return null;
    }
    const issues = incidentRecordIssues(parsed.data, where).filter((x) => x.severity === "error");
    problems.push(...issues.map((x) => `${x.path}: ${x.code}: ${x.message}`));
    wordCheck(where, "summary", parsed.data.summary, 60, problems);
    wordCheck(where, "note", parsed.data.attribution_note, 40, problems);
    return parsed.data;
  });
  if (problems.length) fail("incidents", problems);
  return out as Incident[];
}

export function buildStrikes(dir: string, added: string): Strike[] {
  const file = path.join(dir, "strikes.yaml");
  if (!fs.existsSync(file)) return [];
  const recs = parseList(file, SeedStrike).map((rec, i) => ({ rec, where: `${file} [${i}] ${rec.date}` }));
  recs.sort((a, b) => a.rec.date.localeCompare(b.rec.date));
  const seq = new Map<number, number>();
  const problems: string[] = [];
  const out = recs.map(({ rec, where }) => {
    const year = Number(rec.date.slice(0, 4));
    const n = (seq.get(year) ?? 0) + 1;
    seq.set(year, n);
    const parsed = Strike.safeParse({
      id: `STR-${year}-${String(n).padStart(4, "0")}`,
      date: rec.date,
      target_name: rec.target,
      target_type: rec.target_type,
      region: rec.region,
      occupied_territory: rec.occupied ?? false,
      lat: rec.lat ?? null,
      lon: rec.lon ?? null,
      distance_km: rec.km ?? null,
      weapon: rec.weapon,
      weapon_detail: rec.weapon_detail ?? null,
      western_weapon: rec.western ?? null,
      verification: rec.verification,
      damage: rec.damage?.trim() ?? null,
      effect: rec.effect?.trim() ?? null,
      summary: rec.summary.trim(),
      sources: rec.src.map(toSource),
      seed: true,
      added,
      updated: null,
    });
    if (!parsed.success) {
      problems.push(...parsed.error.issues.map((x) => `${where}: ${x.path.join(".")}: ${x.message}`));
      return null;
    }
    problems.push(...strikeRecordIssues(parsed.data, where).filter((x) => x.severity === "error").map((x) => `${x.path}: ${x.code}: ${x.message}`));
    wordCheck(where, "summary", parsed.data.summary, 50, problems);
    wordCheck(where, "damage", parsed.data.damage, 30, problems);
    wordCheck(where, "effect", parsed.data.effect, 30, problems);
    return parsed.data;
  });
  if (problems.length) fail("strikes", problems);
  return out as Strike[];
}

export function buildState(dir: string, current: State, incidents: Incident[]): State {
  const seed = SeedState.parse(readYaml(path.join(dir, "state.yaml")));
  const pathways = PATHWAYS.map((p) => {
    const s = seed.pathways[p];
    if (!s) fail("state.yaml", [`pathways.${p} is missing`]);
    return { pathway: p, serious_odds: s.serious_odds, impact: s.impact, trend: "flat" };
  });
  const countries = TIER1.map((c) => {
    const s = seed.countries[c];
    if (!s) fail("state.yaml", [`countries.${c} is missing`]);
    return { country: c, score: s.score, since: s.since };
  });
  const floors = countryFloors(incidents, seed.as_of);
  const activeStrategic = (c: string) => current.indicators.some((ind) =>
    ind.tier === "strategic" && seed.indicators[ind.id]?.status === "active" && (ind.countries as string[]).includes(c));
  const outOfRange = countries.filter((c) => c.score < floors[c.country].floor || (c.score > floors[c.country].floor + 1 && !activeStrategic(c.country)));
  if (outOfRange.length) {
    fail("state.yaml", outOfRange.map((c) => `countries.${c.country}: score ${c.score} is outside its floor ${floors[c.country].floor} (+1, or more with an active strategic indicator naming it)`));
  }
  const known = new Set(current.indicators.map((i) => i.id));
  const unknown = Object.keys(seed.indicators).filter((id) => !known.has(id));
  if (unknown.length) fail("state.yaml", unknown.map((id) => `indicators.${id} isn't in content/state.json`));
  const indicators = current.indicators.map((ind) => {
    const s = seed.indicators[ind.id];
    return s ? { ...ind, status: s.status, since: s.since, last_evidence: s.evidence, last_evidence_date: s.evidence_date } : ind;
  });
  return State.parse({
    ...current,
    as_of: "seed",
    ladder: { current_rung: computedRung(incidents, seed.as_of), next_rung_odds: seed.next_rung_odds },
    pathways,
    countries,
    indicators,
    weekly: null,
  });
}

export function buildForecasts(dir: string, opened: string): Forecast[] {
  const file = path.join(dir, "forecasts.yaml");
  if (!fs.existsSync(file)) return [];
  const year = opened.slice(0, 4);
  return parseList(file, SeedForecast).map((f, i) => Forecast.parse({
    id: `F-${year}-${String(i + 1).padStart(3, "0")}`,
    ...f,
    opened,
    updates: [],
    status: "open",
    resolved_on: null,
    resolution_note: null,
    resolution_source: null,
    brier: null,
    brier_base: null,
  }));
}

/** The generated part of docs/SEED-REPORT.md. */
export function reportTables(incidents: Incident[], strikes: Strike[], state: State, asOf: string): string {
  const years = [...new Set(incidents.map((i) => i.date.slice(0, 4)))].sort();
  const row = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
  const lines: string[] = [];
  const count = (f: (i: Incident) => boolean) => incidents.filter(f).length;

  lines.push(`Generated by \`npm run seed:build\` from \`research/seed/\`. Counts as of ${asOf}.`, "");
  lines.push("### Incidents by pathway and year", "");
  lines.push(row(["Pathway", ...years, "Total", "Serious"]), row(["---", ...years.map(() => "---:"), "---:", "---:"]));
  for (const p of PATHWAYS) {
    lines.push(row([p, ...years.map((y) => count((i) => i.pathway === p && i.date.startsWith(y))), count((i) => i.pathway === p), count((i) => i.pathway === p && i.serious)]));
  }
  lines.push(row(["**All**", ...years.map((y) => count((i) => i.date.startsWith(y))), incidents.length, count((i) => i.serious)]), "");

  lines.push("### Incidents by rung and year", "");
  lines.push(row(["Rung", ...years, "Total"]), row(["---", ...years.map(() => "---:"), "---:"]));
  for (const r of RUNGS.filter((x) => x.rung > 0)) {
    lines.push(row([`${r.rung} ${r.name}`, ...years.map((y) => count((i) => i.rung === r.rung && i.date.startsWith(y))), count((i) => i.rung === r.rung)]));
  }
  lines.push("");

  lines.push("### Incidents by affected country (tier 1)", "");
  lines.push(row(["Country", "Incidents", "Rung 3+", "Serious"]), row(["---", "---:", "---:", "---:"]));
  for (const c of TIER1) {
    const mine = incidents.filter((i) => (i.affected as string[]).includes(c));
    lines.push(row([c, mine.length, mine.filter((i) => i.rung >= 3).length, mine.filter((i) => i.serious).length]));
  }
  lines.push("");

  lines.push("### Serious incidents", "");
  lines.push(row(["Id", "Date", "Where", "Pathway", "Rung", "Summary"]), row(["---", "---", "---", "---", "---:", "---"]));
  for (const i of incidents.filter((x) => x.serious)) {
    lines.push(row([i.id, i.date, i.location_country, i.pathway, i.rung, i.summary.replace(/\|/g, "/")]));
  }
  lines.push("");

  if (strikes.length) {
    lines.push("### Strikes by target type and verification", "");
    const types = [...new Set(strikes.map((s) => s.target_type))].sort();
    lines.push(row(["Target type", "1", "2", "3", "4", "5", "Total"]), row(["---", "---:", "---:", "---:", "---:", "---:", "---:"]));
    for (const t of types) {
      const mine = strikes.filter((s) => s.target_type === t);
      lines.push(row([t, ...[1, 2, 3, 4, 5].map((v) => mine.filter((s) => s.verification === v).length), mine.length]));
    }
    lines.push("");
  }

  lines.push("### Computed starting values", "");
  lines.push(`- Current rung (highest in the 30 days to ${asOf}): **${state.ladder.current_rung}**.`);
  const counts = pathwayCounts(incidents, asOf);
  lines.push("", row(["Pathway", "Last 30 days", "Monthly baseline (days 31–120)", "Serious, 12 months", "Monthly average since 2022", "Seed odds", "Impact"]),
    row(["---", "---:", "---:", "---:", "---:", "---:", "---:"]));
  for (const p of state.pathways) {
    const c = counts[p.pathway];
    lines.push(row([p.pathway, c.incidents_30d, c.baseline_monthly, c.serious_12m, c.monthly_avg_since_2022, `${p.serious_odds.term} (${p.serious_odds.probability}%)`, p.impact]));
  }
  const floors = countryFloors(incidents, asOf);
  lines.push("", row(["Country", "Max rung, 30 days", "Floor", "Seed score"]), row(["---", "---:", "---:", "---:"]));
  for (const c of state.countries) lines.push(row([c.country, floors[c.country].max_rung_30d, floors[c.country].floor, c.score]));
  return lines.join("\n");
}

function writeReport(tables: string) {
  const text = fs.existsSync(REPORT) ? fs.readFileSync(REPORT, "utf8") : `# Seed report\n\n${MARK_START}\n${MARK_END}\n`;
  const a = text.indexOf(MARK_START);
  const b = text.indexOf(MARK_END);
  if (a < 0 || b < a) throw new SeedError(`${REPORT} needs the ${MARK_START} and ${MARK_END} markers`);
  fs.writeFileSync(REPORT, `${text.slice(0, a + MARK_START.length)}\n${tables}\n${text.slice(b)}`);
}

function main(argv: string[]): number {
  const { values } = parseArgs({ args: argv, options: { check: { type: "boolean", default: false } } });
  const raw = readRawContent(CONTENT);
  const live = raw.briefs.length > 0
    || raw.incidents.some((f) => JSON.stringify(f.data).includes('"seed":false'))
    || raw.strikes.some((f) => JSON.stringify(f.data).includes('"seed":false'));
  if (live) {
    console.error("content/ already has daily briefs or non-seed records; the seed builder only runs before go-live.");
    return 2;
  }
  const meta = SeedState.parse(readYaml(path.join(SEED_DIR, "state.yaml")));
  const current = State.parse(JSON.parse(fs.readFileSync(path.join(CONTENT, "state.json"), "utf8")));

  const incidents = buildIncidents(SEED_DIR, meta.added);
  const strikes = buildStrikes(SEED_DIR, meta.added);
  const state = buildState(SEED_DIR, current, incidents);
  const forecasts = buildForecasts(SEED_DIR, meta.added);

  const files = new Map<string, string>();
  const byYear = <T extends { date: string }>(items: T[]) => {
    const groups = new Map<number, T[]>();
    for (const x of items) {
      const year = Number(x.date.slice(0, 4));
      groups.set(year, [...(groups.get(year) ?? []), x]);
    }
    return groups;
  };
  for (const [year, list] of byYear(incidents)) files.set(`incidents/${year}.json`, json(IncidentsFile.parse({ schema_version: 1, year, incidents: list })));
  for (const [year, list] of byYear(strikes)) files.set(`strikes/${year}.json`, json(StrikesFile.parse({ schema_version: 1, year, strikes: list })));
  files.set("state.json", json(state));
  files.set("forecasts.json", json(ForecastsFile.parse({ schema_version: 1, forecasts })));

  // Validate the result as a whole in a scratch copy of content/ before touching the real one.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "seed-"));
  try {
    fs.cpSync(CONTENT, scratch, { recursive: true });
    for (const sub of ["incidents", "strikes"]) {
      for (const f of fs.readdirSync(path.join(scratch, sub))) fs.rmSync(path.join(scratch, sub, f));
    }
    for (const [rel, text] of files) fs.writeFileSync(path.join(scratch, rel), text);
    const result = validateAll(scratch);
    const show = (i: ValidationIssue) => console.log(`${i.severity.toUpperCase()} ${i.code} ${i.path}: ${i.message}`);
    result.errors.forEach(show);
    result.warnings.forEach(show);
    if (!result.ok) return 1;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  const tables = reportTables(incidents, strikes, state, meta.as_of);
  console.log(`${incidents.length} incidents, ${strikes.length} strikes, ${forecasts.length} forecasts; current rung ${state.ladder.current_rung}.`);
  if (values.check) return 0;
  for (const sub of ["incidents", "strikes"]) {
    for (const f of fs.readdirSync(path.join(CONTENT, sub))) fs.rmSync(path.join(CONTENT, sub, f));
  }
  for (const [rel, text] of files) fs.writeFileSync(path.join(CONTENT, rel), text);
  writeReport(tables);
  console.log(`Wrote content/ and ${REPORT}.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof SeedError) {
      console.error(e.message);
      process.exitCode = 1;
    } else throw e;
  }
}
