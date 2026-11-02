import type { z } from "zod";
import { brier, computedRung, countryFloors, pathwayCounts } from "./aggregate";
import { applyIncidentChanges, applyStrikeChanges } from "./apply";
import { readRawContent, type RawFile } from "./content";
import { yearOf } from "./dates";
import { Brief } from "./schema/brief";
import type { AgentContext } from "./schema/context";
import { DraftBrief } from "./schema/draft-brief";
import { ForecastsFile } from "./schema/forecast";
import { IncidentsFile, type Incident } from "./schema/incident";
import { ArchiveIndex, CorrectionsFile } from "./schema/misc";
import { State } from "./schema/state";
import { StrikesFile } from "./schema/strike";
import { boardRules } from "./rules/board";
import { developmentRules } from "./rules/developments";
import { forecastRules } from "./rules/forecasts";
import { indicatorRules } from "./rules/indicators";
import { metaRules } from "./rules/meta";
import { recordRules } from "./rules/records";
import { sourceRules } from "./rules/sources";
import { error, type Derived, type IncidentRecord, type IndicatorView, type Rule, type RuleInput, type ValidationIssue, type World } from "./rules/types";
import { totalWords, wordRules } from "./rules/words";
import { normalizeUrl } from "./urls";
import { PATHWAYS, TIER1 } from "./vocab";

export type { ValidationIssue, World } from "./rules/types";

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export const RULES: Rule[] = [metaRules, wordRules, boardRules, developmentRules, sourceRules, recordRules, indicatorRules, forecastRules];

// ---------------------------------------------------------------------------------------------------
// Schema issues

export function formatPath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const p of path) {
    if (typeof p === "number") out += `[${p}]`;
    else out += out ? `.${String(p)}` : String(p);
  }
  return out || "(root)";
}

export function schemaIssues(err: z.ZodError, prefix = ""): ValidationIssue[] {
  const at = (p: string) => (prefix ? `${prefix}${p === "(root)" ? "" : `: ${p}`}` : p);
  const out: ValidationIssue[] = [];
  for (const issue of err.issues) {
    const base = formatPath(issue.path);
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        const p = base === "(root)" ? key : `${base}.${key}`;
        out.push(error("SCHEMA", at(p), `Unknown key "${key}"; remove it. Only keys the schema defines are allowed.`));
      }
      continue;
    }
    let message = issue.message;
    let hint: string | null = null;
    if (issue.code === "invalid_type" && /received undefined/.test(issue.message)) {
      message = `Missing key (expected ${issue.expected}).`;
      hint = "Every key is required; use null or [] when there is nothing to report.";
    } else if (issue.code === "invalid_union") {
      message = "Doesn't match any allowed form for this field; check the schema's description.";
    }
    out.push(error("SCHEMA", at(base), message, hint));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Draft validation

export function worldFromContext(context: AgentContext): World {
  return { incidents: context.computed.incidents_last_30d, strikes: context.recent_strikes, forecasts: context.open_forecasts };
}

function derive(draft: DraftBrief, date: string, context: AgentContext | null, world: World | null): Derived {
  const sourcesById = new Map<string, DraftBrief["sources"][number]>();
  for (const s of draft.sources) if (!sourcesById.has(s.id)) sourcesById.set(s.id, s);

  const incUpdates = new Map(draft.incident_updates.map((u) => [u.id, u]));
  const existing: IncidentRecord[] = (world?.incidents ?? []).map((rec) => {
    const u = incUpdates.get(rec.id);
    return u ? applyIncidentChanges(rec, u) : rec;
  });
  const incidentsAfter: IncidentRecord[] = [...existing, ...draft.incidents_new];
  const incidentsById = new Map(incidentsAfter.map((i) => [i.id, i]));

  const strUpdates = new Map(draft.strike_updates.map((u) => [u.id, u]));
  const strikesById: Derived["strikesById"] = new Map();
  for (const rec of world?.strikes ?? []) {
    const u = strUpdates.get(rec.id);
    strikesById.set(rec.id, u ? applyStrikeChanges(rec, u) : rec);
  }
  for (const s of draft.strikes_new) strikesById.set(s.id, s);

  const indicatorsAfter = new Map<string, IndicatorView>();
  for (const i of context?.state.indicators ?? []) indicatorsAfter.set(i.id, { tier: i.tier, countries: i.countries, status: i.status });
  for (const c of draft.indicator_changes) {
    const cur = indicatorsAfter.get(c.id);
    if (cur) indicatorsAfter.set(c.id, { ...cur, status: c.to });
  }
  for (const n of draft.indicators_new) {
    if (!indicatorsAfter.has(n.id)) indicatorsAfter.set(n.id, { tier: n.tier, countries: n.countries, status: n.status });
  }

  return {
    sourcesById,
    incidentsAfter,
    incidentsById,
    strikesById,
    computedRung: computedRung(incidentsAfter, date),
    floors: countryFloors(incidentsAfter, date),
    indicatorsAfter,
  };
}

function overlaps(a: string, b: string): boolean {
  const starts = (x: string, y: string) => x === y || x.startsWith(`${y}.`) || x.startsWith(`${y}[`);
  return starts(a, b) || starts(b, a);
}

function runRules(input: Omit<RuleInput, "derived">, bestEffort: boolean, schemaErrors: ValidationIssue[]): ValidationIssue[] {
  const guard = <T>(fn: () => T, fallback: T): T => {
    if (!bestEffort) return fn();
    try { return fn(); } catch { return fallback; }
  };
  const derived = guard(() => derive(input.draft, input.date, input.context, input.world), null);
  if (!derived) return [];
  const blocking = schemaErrors.filter((e) => !e.message.startsWith("Unknown key")).map((e) => e.path);
  const out: ValidationIssue[] = [];
  for (const rule of RULES) {
    for (const issue of guard(() => rule({ ...input, derived }), [] as ValidationIssue[])) {
      if (bestEffort && blocking.some((p) => overlaps(issue.path, p))) continue;
      out.push(bestEffort ? { ...issue, hint: issue.hint ?? "Found while the draft also had schema errors; re-check after fixing those." } : issue);
    }
  }
  return out;
}

function result(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((i) => i.severity === "error");
  return { ok: errors.length === 0, errors, warnings: issues.filter((i) => i.severity === "warning") };
}

export interface DraftOptions {
  context: AgentContext;
  /** Existing records; defaults to what the context carries. */
  world?: World;
  /** URLs the agent could legitimately cite; null skips SOURCE_UNSEEN with a warning. */
  evidence?: Iterable<string> | null;
  /** The date in a YYYY-MM-DD.json file name, when validating a file. */
  fileDate?: string | null;
}

export function validateDraft(input: unknown, opts: DraftOptions): ValidationResult & { draft: DraftBrief | null } {
  const parsed = DraftBrief.safeParse(input);
  const schema = parsed.success ? [] : schemaIssues(parsed.error);
  const isObject = typeof input === "object" && input !== null && !Array.isArray(input);
  const evidence = opts.evidence == null ? null : new Set([...opts.evidence].map(normalizeUrl));
  const rules = parsed.success || isObject
    ? runRules({
        draft: (parsed.success ? parsed.data : input) as DraftBrief,
        date: opts.context.date,
        fileDate: opts.fileDate ?? null,
        context: opts.context,
        world: opts.world ?? worldFromContext(opts.context),
        evidence,
      }, !parsed.success, schema)
    : [];
  return { ...result([...schema, ...rules]), draft: parsed.success ? parsed.data : null };
}

// ---------------------------------------------------------------------------------------------------
// Published briefs and the whole content folder

/** Checks a published brief on its own: schema, the rules that don't need the day-before state, and `computed`. */
export function validatePublished(input: unknown, opts: { fileDate?: string | null; prefix?: string } = {}): ValidationResult {
  const prefix = opts.prefix ?? "";
  const parsed = Brief.safeParse(input);
  if (!parsed.success) return result(schemaIssues(parsed.error, prefix));
  const brief = parsed.data;
  const issues = runRules({ draft: brief, date: brief.date, fileDate: opts.fileDate ?? null, context: null, world: null, evidence: null }, false, []);

  const words = totalWords(brief);
  const cats = new Set(brief.sources.map((s) => s.category)).size;
  if (brief.computed.word_count !== words) issues.push(error("COMPUTED_MISMATCH", "computed.word_count", `word_count is ${brief.computed.word_count} but the brief has ${words} counted words.`));
  if (brief.computed.source_count !== brief.sources.length) issues.push(error("COMPUTED_MISMATCH", "computed.source_count", `source_count is ${brief.computed.source_count} but the brief has ${brief.sources.length} sources.`));
  if (brief.computed.source_category_count !== cats) issues.push(error("COMPUTED_MISMATCH", "computed.source_category_count", `source_category_count is ${brief.computed.source_category_count} but the sources span ${cats} categories.`));

  return result(prefix ? issues.map((i) => ({ ...i, path: `${prefix}: ${i.path}` })) : issues);
}

function parseFile<T>(schema: z.ZodType<T>, raw: RawFile, issues: ValidationIssue[]): T | null {
  const r = schema.safeParse(raw.data);
  if (r.success) return r.data;
  issues.push(...schemaIssues(r.error, raw.file));
  return null;
}

/** `npm run validate:all`: every content file against its schema, plus the cross-file rules (SPEC §4.11). */
export function validateAll(dir: string): ValidationResult {
  const raw = readRawContent(dir);
  const issues: ValidationIssue[] = raw.problems
    .filter((p) => p.message !== "File is missing" || p.file === "state.json")
    .map((p) => error("SCHEMA", p.file, p.message));

  const seen = new Map<string, string>();
  const claim = (id: string, where: string) => {
    const first = seen.get(id);
    if (first) issues.push(error("XREF_ID_DUP", where, `${id} also appears in ${first}; ids must be unique across all files.`));
    else seen.set(id, where);
  };

  const known = { incidents: new Set<string>(), strikes: new Set<string>(), forecasts: new Set<string>() };
  const checkRecords = (f: RawFile, year: number, records: { id: string; date: string }[], key: "incidents" | "strikes") => {
    const fileYear = Number(f.file.match(/(\d{4})\.json$/)?.[1]);
    if (year !== fileYear) issues.push(error("XREF_ID_YEAR", `${f.file}: year`, `year is ${year} but the file is ${f.file}.`));
    records.forEach((r, i) => {
      const where = `${f.file}: ${key}[${i}]`;
      claim(r.id, where);
      known[key].add(r.id);
      const idYear = Number(r.id.slice(4, 8));
      if (idYear !== yearOf(r.date) || idYear !== fileYear) {
        issues.push(error("XREF_ID_YEAR", where, `${r.id} is dated ${r.date} in ${f.file}; the id year, the date's year and the file year must match.`));
      }
      const prev = records[i - 1];
      if (prev && (prev.date > r.date || (prev.date === r.date && prev.id > r.id))) {
        issues.push(error("FILE_ORDER", where, `${f.file} must be sorted by date, then id (${r.id} comes after ${prev.id}).`));
      }
    });
  };
  const incidents: Incident[] = [];
  for (const f of raw.incidents) {
    const parsed = parseFile(IncidentsFile, f, issues);
    if (parsed) {
      checkRecords(f, parsed.year, parsed.incidents, "incidents");
      incidents.push(...parsed.incidents);
    }
  }
  for (const f of raw.strikes) {
    const parsed = parseFile(StrikesFile, f, issues);
    if (parsed) checkRecords(f, parsed.year, parsed.strikes, "strikes");
  }

  if (raw.forecasts) {
    const parsed = parseFile(ForecastsFile, raw.forecasts, issues);
    parsed?.forecasts.forEach((f, i) => {
      const where = `forecasts.json: forecasts[${i}]`;
      claim(f.id, where);
      known.forecasts.add(f.id);
      const prev = parsed.forecasts[i - 1];
      if (prev && prev.id > f.id) issues.push(error("FILE_ORDER", where, `forecasts.json must be sorted by id (${f.id} comes after ${prev.id}).`));
      const b = brier(f);
      if (b.brier !== f.brier || b.brier_base !== f.brier_base) {
        issues.push(error("COMPUTED_MISMATCH", where, `${f.id}: stored Brier scores (${f.brier}, ${f.brier_base}) don't match the computed ones (${b.brier}, ${b.brier_base}).`));
      }
    });
  }

  let indicatorIds = new Set<string>();
  if (raw.state) {
    const state = parseFile(State, raw.state, issues);
    if (state) {
      if (state.pathways.map((p) => p.pathway).join() !== PATHWAYS.join()) {
        issues.push(error("STATE_SHAPE", "state.json: pathways", `state.pathways must be the 7 pathways in order: ${PATHWAYS.join(", ")}.`));
      }
      if (state.countries.map((c) => c.country).join() !== TIER1.join()) {
        issues.push(error("STATE_SHAPE", "state.json: countries", `state.countries must be the 7 tier-1 countries in order: ${TIER1.join(", ")}.`));
      }
      const ind = state.indicators.map((i) => i.id);
      const asm = state.assumptions.map((a) => a.id);
      if (new Set(ind).size !== ind.length) issues.push(error("STATE_SHAPE", "state.json: indicators", "Indicator ids must be unique."));
      if (new Set(asm).size !== asm.length) issues.push(error("STATE_SHAPE", "state.json: assumptions", "Assumption ids must be unique."));
      indicatorIds = new Set(ind);
    }
  }

  if (raw.corrections) parseFile(CorrectionsFile, raw.corrections, issues);
  if (raw.archiveIndex) parseFile(ArchiveIndex, raw.archiveIndex, issues);

  const briefDates = new Set<string>();
  for (const f of raw.briefs) {
    const fileDate = f.file.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1] ?? null;
    if (!fileDate) {
      issues.push(error("FILE_NAME", f.file, "Brief files must be named YYYY-MM-DD.json."));
      continue;
    }
    briefDates.add(fileDate);
    const r = validatePublished(f.data, { fileDate, prefix: f.file });
    issues.push(...r.errors, ...r.warnings);
    const parsed = Brief.safeParse(f.data);
    if (!parsed.success) continue;
    const b = parsed.data;
    // computed.pathways is a snapshot: count the records that had been added when the brief was published.
    const counts = pathwayCounts(incidents.filter((x) => x.added <= b.date), b.date);
    for (const p of PATHWAYS) {
      for (const field of ["incidents_30d", "baseline_monthly"] as const) {
        const stored = b.computed.pathways[p][field];
        if (stored !== counts[p][field]) {
          issues.push(error("COMPUTED_MISMATCH", `${f.file}: computed.pathways.${p}.${field}`,
            `${f.file}: computed.pathways.${p}.${field} is ${stored} but the incidents added by ${b.date} give ${counts[p][field]}.`));
        }
      }
    }
    const unresolved = (where: string, ids: string[], set: Set<string>, what: string) => {
      const missing = ids.filter((id) => !set.has(id));
      if (missing.length) issues.push(error("XREF_UNRESOLVED", `${f.file}: ${where}`, `Unknown ${what}: ${missing.join(", ")}.`));
    };
    unresolved("incidents_new", b.incidents_new.map((x) => x.id), known.incidents, "incidents (not in content/incidents)");
    unresolved("strikes_new", b.strikes_new.map((x) => x.id), known.strikes, "strikes (not in content/strikes)");
    unresolved("incident_updates", b.incident_updates.map((x) => x.id), known.incidents, "incidents");
    unresolved("strike_updates", b.strike_updates.map((x) => x.id), known.strikes, "strikes");
    b.developments.forEach((d, i) => {
      unresolved(`developments[${i}].incident_ids`, d.incident_ids, known.incidents, "incidents");
      unresolved(`developments[${i}].strike_ids`, d.strike_ids, known.strikes, "strikes");
    });
    unresolved("forecasts", [...b.forecasts_new, ...b.forecast_updates, ...b.forecast_resolutions].map((x) => x.id), known.forecasts, "forecasts (not in forecasts.json)");
    if (raw.state) {
      unresolved("indicators", [...b.indicator_changes, ...b.indicators_new].map((x) => x.id), indicatorIds, "indicators (not in state.json)");
    }
  }

  if (raw.corrections) {
    const parsed = CorrectionsFile.safeParse(raw.corrections.data);
    if (parsed.success) {
      const sets = { brief: briefDates, incident: known.incidents, strike: known.strikes, forecast: known.forecasts };
      parsed.data.corrections.forEach((c, i) => {
        if (!sets[c.target.kind].has(c.target.id)) {
          issues.push(error("XREF_UNRESOLVED", `corrections.json: corrections[${i}].target`, `${c.id} targets unknown ${c.target.kind} ${c.target.id}.`));
        }
      });
    }
  }

  return result(issues);
}
