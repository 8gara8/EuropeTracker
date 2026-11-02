import { parseForecastId, parseRecordId } from "../aggregate";
import { applyIncidentChanges, applyStrikeChanges } from "../apply";
import { yearOf } from "../dates";
import type { EvidenceSource } from "../schema/common";
import type { Incident } from "../schema/incident";
import type { Strike } from "../schema/strike";
import { INCIDENT_TYPES, PATHWAYS_WITH_THREAT_LOCATIONS, THREAT_LOCATIONS, incidentTypeInfo, isEuropean } from "../vocab";
import { error, warning, type Rule, type ValidationIssue } from "./types";

// ID_FORMAT, ID_SEQUENCE, ID_DUPLICATE, RECORD_FIELDS, INCIDENT_TYPE, INCIDENT_RUNG, INCIDENT_LOCATION,
// INCIDENT_SERIOUS, INCIDENT_SOURCES, INCIDENT_PRECISION, UPDATE_TARGET, UPDATE_EVIDENCE, STRIKE_EVIDENCE.

const THREAT = THREAT_LOCATIONS as readonly string[];

/** What a strike's verification level still lacks (STYLE.md §6). Levels are not cumulative. */
export function strikeEvidenceGaps(
  level: number,
  sources: Pick<EvidenceSource, "category">[],
  damage: string | null,
  effect: string | null,
): string[] {
  const cats = new Set(sources.map((s) => s.category));
  const gaps: string[] = [];
  if (sources.length === 0) gaps.push("at least one source");
  if (level === 2 && !cats.has("ru_gov") && !cats.has("ru_state_media")) gaps.push("a ru_gov or ru_state_media source (level 2, Acknowledged)");
  if (level === 3 && !cats.has("osint_data")) gaps.push("an osint_data source (level 3, Geolocated)");
  if (level === 4 && !cats.has("intl_press") && !cats.has("osint_data")) gaps.push("an intl_press or osint_data source (level 4, Damage assessed)");
  if (level >= 4 && !damage?.trim()) gaps.push("a damage description (required at level 4 and above)");
  if (level === 5 && !cats.has("markets_energy") && !cats.has("intl_press") && !cats.has("ru_gov")) gaps.push("a markets_energy, intl_press or ru_gov source (level 5, Effect confirmed)");
  if (level === 5 && !effect?.trim()) gaps.push("an effect description (required at level 5)");
  return gaps;
}

function sequenceIssues(
  path: string,
  label: string,
  items: { id: string; year: number; seq: number }[],
  next: Record<string, string>,
  pad: number,
  prefix: string,
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const byYear = new Map<number, number[]>();
  for (const it of items) byYear.set(it.year, [...(byYear.get(it.year) ?? []), it.seq]);
  for (const [year, seqs] of byYear) {
    const start = next[String(year)];
    const startSeq = start ? Number(start.slice(-pad)) : null;
    if (startSeq === null) {
      out.push(error("ID_SEQUENCE", path, `No ${label} id sequence for ${year}: next_ids covers only ${Object.keys(next).join(", ")}. Check the record's date.`));
      continue;
    }
    const sorted = [...seqs].sort((a, b) => a - b);
    const expected = sorted.map((_, k) => startSeq + k);
    if (sorted.join() !== expected.join()) {
      const fmt = (n: number) => `${prefix}-${year}-${String(n).padStart(pad, "0")}`;
      out.push(error("ID_SEQUENCE", path,
        `New ${label} ids for ${year} must continue next_ids without gaps: use ${expected.map(fmt).join(", ")} (got ${sorted.map(fmt).join(", ")}).`));
    }
  }
  return out;
}

const ids: Rule = ({ draft, date, context, world }) => {
  const out: ValidationIssue[] = [];
  const incidents: { id: string; year: number; seq: number }[] = [];
  const strikes: { id: string; year: number; seq: number }[] = [];
  const forecasts: { id: string; year: number; seq: number }[] = [];

  draft.incidents_new.forEach((x, i) => {
    const p = parseRecordId(x.id);
    if (!p || p.kind !== "INC") {
      out.push(error("ID_FORMAT", `incidents_new[${i}].id`, `"${x.id}" isn't an incident id; use INC-YYYY-NNNN.`));
    } else if (p.year !== yearOf(x.date)) {
      out.push(error("ID_FORMAT", `incidents_new[${i}].id`, `${x.id} must use the year of its date (${x.date.slice(0, 4)}): INC-${x.date.slice(0, 4)}-NNNN from next_ids.`));
    } else incidents.push({ id: x.id, ...p });
  });
  draft.strikes_new.forEach((x, i) => {
    const p = parseRecordId(x.id);
    if (!p || p.kind !== "STR") {
      out.push(error("ID_FORMAT", `strikes_new[${i}].id`, `"${x.id}" isn't a strike id; use STR-YYYY-NNNN.`));
    } else if (p.year !== yearOf(x.date)) {
      out.push(error("ID_FORMAT", `strikes_new[${i}].id`, `${x.id} must use the year of its date (${x.date.slice(0, 4)}): STR-${x.date.slice(0, 4)}-NNNN from next_ids.`));
    } else strikes.push({ id: x.id, ...p });
  });
  draft.forecasts_new.forEach((x, i) => {
    const p = parseForecastId(x.id);
    if (!p) {
      out.push(error("ID_FORMAT", `forecasts_new[${i}].id`, `"${x.id}" isn't a forecast id; use F-YYYY-NNN.`));
    } else if (p.year !== yearOf(date)) {
      out.push(error("ID_FORMAT", `forecasts_new[${i}].id`, `${x.id} must use the year of the brief (${date.slice(0, 4)}).`));
    } else forecasts.push({ id: x.id, ...p });
  });

  const dupes = (list: string[]) => [...new Set(list.filter((id, k) => list.indexOf(id) !== k))];
  const devDup = dupes(draft.developments.map((d) => d.id));
  if (devDup.length) out.push(error("ID_DUPLICATE", "developments", `Development ids must be unique: ${devDup.join(", ")} repeat.`));

  if (!context || !world) return out;

  out.push(...sequenceIssues("incidents_new", "incident", incidents, context.next_ids.incident, 4, "INC"));
  out.push(...sequenceIssues("strikes_new", "strike", strikes, context.next_ids.strike, 4, "STR"));
  out.push(...sequenceIssues("forecasts_new", "forecast", forecasts, { [String(yearOf(date))]: context.next_ids.forecast }, 3, "F"));

  const existing = new Set([...world.incidents.map((x) => x.id), ...world.strikes.map((x) => x.id), ...world.forecasts.map((x) => x.id)]);
  const all = [...draft.incidents_new.map((x) => x.id), ...draft.strikes_new.map((x) => x.id), ...draft.forecasts_new.map((x) => x.id)];
  const clash = [...new Set(all.filter((id) => existing.has(id)))];
  const repeat = dupes(all);
  if (clash.length) out.push(error("ID_DUPLICATE", "(new records)", `These new ids already exist: ${clash.join(", ")}. Continue from next_ids instead.`));
  if (repeat.length) out.push(error("ID_DUPLICATE", "(new records)", `These new ids are used more than once: ${repeat.join(", ")}.`));
  return out;
};

const recordFields: Rule = ({ draft, date }) => {
  const out: ValidationIssue[] = [];
  const check = (kind: string, path: string, x: { id: string; date: string; seed: boolean; added: string; updated: string | null }) => {
    if (x.date > date) out.push(error("RECORD_FIELDS", `${path}.date`, `${x.id} is dated ${x.date}, after the brief date ${date}.`));
    if (x.seed) out.push(error("RECORD_FIELDS", `${path}.seed`, `${x.id}: new ${kind} in a daily brief must have seed: false.`));
    if (x.added !== date) out.push(warning("RECORD_FIELDS", `${path}.added`, `${x.id}: added should be ${date}; publish sets it.`));
    if (x.updated !== null) out.push(warning("RECORD_FIELDS", `${path}.updated`, `${x.id}: updated should be null for a new record; publish sets it.`));
  };
  draft.incidents_new.forEach((x, i) => check("incidents", `incidents_new[${i}]`, x));
  draft.strikes_new.forEach((x, i) => check("strikes", `strikes_new[${i}]`, x));
  return out;
};

type IncidentLike = Pick<Incident, "id" | "date" | "date_precision" | "location_country" | "affected" | "pathway" | "type" | "rung" | "serious" | "attribution" | "host_statement" | "casualties" | "sources" | "seed">;

/** INCIDENT_TYPE, INCIDENT_RUNG, INCIDENT_LOCATION, INCIDENT_SERIOUS, INCIDENT_SOURCES and INCIDENT_PRECISION for one record. */
export function incidentRecordIssues(x: IncidentLike, at: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const info = incidentTypeInfo(x.pathway, x.type);
  if (!info) {
    out.push(error("INCIDENT_TYPE", `${at}.type`,
      `"${x.type}" isn't a ${x.pathway} incident type; use one of ${Object.keys(INCIDENT_TYPES[x.pathway]).join(", ")}, or "other".`));
  } else if (x.type === "other") {
    out.push(warning("INCIDENT_TYPE", `${at}.type`, `${x.id} uses type "other"; prefer a defined ${x.pathway} type.`));
  }
  if (info && (x.rung < info.min || x.rung > info.max)) {
    out.push(error("INCIDENT_RUNG", `${at}.rung`, `${x.id}: a ${x.type} incident must be rung ${info.min === info.max ? info.min : `${info.min}–${info.max}`} (got ${x.rung}).`));
  }
  if (x.casualties.killed > 0 && x.rung < 4) {
    out.push(error("INCIDENT_RUNG", `${at}.rung`, `${x.id}: deaths on European soil mean rung 4 or higher (got ${x.rung}).`));
  }
  const threat = THREAT.includes(x.location_country);
  if (threat && x.rung > 1) {
    out.push(error("INCIDENT_RUNG", `${at}.rung`, `${x.id}: an incident located in ${x.location_country} stays at rung 1 unless its effects physically reach Europe; then locate it there.`));
  }
  if (threat && !PATHWAYS_WITH_THREAT_LOCATIONS.includes(x.pathway)) {
    out.push(error("INCIDENT_LOCATION", `${at}.location_country`, `${x.id}: location ${x.location_country} is allowed only for military_pressure and nuclear; use the European country where it happened.`));
  }
  if (x.affected.length === 0) {
    out.push(error("INCIDENT_LOCATION", `${at}.affected`, `${x.id}: list at least one affected European country.`));
  }
  if (isEuropean(x.location_country) && !(x.affected as string[]).includes(x.location_country)) {
    out.push(error("INCIDENT_LOCATION", `${at}.affected`, `${x.id}: affected must include the location country ${x.location_country}.`));
  }
  if ((x.rung >= 4 || x.casualties.killed > 0) && !x.serious) {
    out.push(error("INCIDENT_SERIOUS", `${at}.serious`, `${x.id}: rung 4 or higher, or any death, makes it serious; set serious to true.`));
  }
  const cats = new Set(x.sources.map((s) => s.category));
  if (x.seed) {
    if (x.sources.length < 1) out.push(error("INCIDENT_SOURCES", `${at}.sources`, `${x.id}: a seed incident needs at least one source.`));
  } else {
    if (x.sources.length < 2 || cats.size < 2) {
      out.push(error("INCIDENT_SOURCES", `${at}.sources`, `${x.id} needs at least 2 sources from at least 2 categories (has ${x.sources.length} from ${cats.size}).`));
    }
    if (x.host_statement === "yes" && !cats.has("eu_gov_security") && !cats.has("nato_eu")) {
      out.push(error("INCIDENT_SOURCES", `${at}.sources`, `${x.id}: host_statement is "yes", so cite that statement (eu_gov_security) or NATO/EU (nato_eu).`));
    }
    if (x.host_statement === "none_yet" && x.attribution > 2) {
      out.push(error("INCIDENT_SOURCES", `${at}.attribution`, `${x.id}: without a host statement, attribution can be at most 2 (Suspected).`));
    }
  }
  if (x.date_precision === "month" && !x.seed) {
    out.push(error("INCIDENT_PRECISION", `${at}.date_precision`, `${x.id}: date_precision "month" is only for seed records; give the day.`));
  }
  if (x.date_precision === "month" && !x.date.endsWith("-01")) {
    out.push(error("INCIDENT_PRECISION", `${at}.date`, `${x.id}: with date_precision "month", date must be the 1st of the month.`));
  }
  return out;
}

/** STRIKE_EVIDENCE for one record. */
export function strikeRecordIssues(x: Pick<Strike, "id" | "verification" | "sources" | "damage" | "effect">, at: string): ValidationIssue[] {
  const gaps = strikeEvidenceGaps(x.verification, x.sources, x.damage, x.effect);
  return gaps.length
    ? [error("STRIKE_EVIDENCE", at, `${x.id} at verification ${x.verification} lacks ${gaps.join("; ")}. Add the evidence or lower the level.`)]
    : [];
}

const incidents: Rule = ({ draft }) => draft.incidents_new.flatMap((x, i) => incidentRecordIssues(x, `incidents_new[${i}]`));

const strikes: Rule = ({ draft }) => draft.strikes_new.flatMap((x, i) => strikeRecordIssues(x, `strikes_new[${i}]`));

const updates: Rule = ({ draft, context, world }) => {
  if (!context || !world) return [];
  const out: ValidationIssue[] = [];
  const known = new Map(world.incidents.map((x) => [x.id, x]));
  const knownStrikes = new Map(world.strikes.map((x) => [x.id, x]));
  const newInc = new Set(draft.incidents_new.map((x) => x.id));
  const newStr = new Set(draft.strikes_new.map((x) => x.id));
  const seen = new Set<string>();

  draft.incident_updates.forEach((u, i) => {
    const at = `incident_updates[${i}]`;
    const rec = known.get(u.id);
    if (newInc.has(u.id)) out.push(error("UPDATE_TARGET", `${at}.id`, `${u.id} is new today; put the change in incidents_new instead of an update.`));
    else if (!rec) out.push(error("UPDATE_TARGET", `${at}.id`, `${u.id} isn't a known incident; check the id.`));
    if (seen.has(u.id)) out.push(error("UPDATE_TARGET", `${at}.id`, `${u.id} is updated twice; merge the updates.`));
    seen.add(u.id);
    if (Object.values(u.changes).every((v) => v === null)) {
      out.push(error("UPDATE_TARGET", `${at}.changes`, `The update to ${u.id} changes nothing; set a change or remove it.`));
    }
    if ((u.changes.attribution !== null || u.changes.rung !== null || u.changes.host_statement !== null) && u.add_sources.length === 0) {
      out.push(error("UPDATE_EVIDENCE", `${at}.add_sources`, `${u.id}: a change of attribution, rung or host_statement needs at least one new source in add_sources.`));
    }
    if (rec && u.changes.rung !== null && rec.pathway && rec.type) {
      const info = incidentTypeInfo(rec.pathway, rec.type);
      if (info && (u.changes.rung < info.min || u.changes.rung > info.max)) {
        out.push(error("INCIDENT_RUNG", `${at}.changes.rung`, `${u.id} is a ${rec.type} incident, which must be rung ${info.min}–${info.max}.`));
      }
    }
    if (rec) {
      // Check the record as it will be after the update. The context's abbreviated records have no
      // casualties or serious flag until an update supplies them.
      const after = applyIncidentChanges(rec, u);
      const killed = after.casualties?.killed ?? 0;
      if (killed > 0 && after.rung < 4) {
        out.push(error("INCIDENT_RUNG", `${at}.changes.rung`,
          `${u.id} would have ${killed} killed at rung ${after.rung}; deaths on European soil mean rung 4 or higher. Set changes.rung to 4 and cite the source in add_sources.`));
      }
      if (after.serious !== undefined && (after.rung >= 4 || killed > 0) && !after.serious) {
        out.push(error("INCIDENT_SERIOUS", `${at}.changes.serious`, `${u.id} would be rung ${after.rung} with ${killed} killed; set changes.serious to true.`));
      }
      // INCIDENT_SOURCES's host-statement rules, which seed records are exempt from.
      if (rec.seed !== true && after.host_statement === "none_yet" && after.attribution > 2) {
        out.push(error("INCIDENT_SOURCES", `${at}.changes.host_statement`,
          `${u.id} would be attribution ${after.attribution} with host_statement "none_yet"; above 2 (Suspected) needs a statement from the affected government or agency. Set changes.host_statement to "yes" and cite the statement in add_sources, or keep attribution at 2.`));
      }
      if (rec.seed !== true && u.changes.host_statement === "yes") {
        const cats = new Set([...(rec.sources ?? []), ...u.add_sources].map((s) => s.category));
        if (!cats.has("eu_gov_security") && !cats.has("nato_eu")) {
          out.push(error("INCIDENT_SOURCES", `${at}.add_sources`, `${u.id}: host_statement "yes" needs the statement cited; add it to add_sources (eu_gov_security or nato_eu).`));
        }
      }
    }
  });

  seen.clear();
  draft.strike_updates.forEach((u, i) => {
    const at = `strike_updates[${i}]`;
    const rec = knownStrikes.get(u.id);
    if (newStr.has(u.id)) out.push(error("UPDATE_TARGET", `${at}.id`, `${u.id} is new today; put the change in strikes_new instead of an update.`));
    else if (!rec) out.push(error("UPDATE_TARGET", `${at}.id`, `${u.id} isn't a known strike; check the id.`));
    if (seen.has(u.id)) out.push(error("UPDATE_TARGET", `${at}.id`, `${u.id} is updated twice; merge the updates.`));
    seen.add(u.id);
    if (Object.values(u.changes).every((v) => v === null)) {
      out.push(error("UPDATE_TARGET", `${at}.changes`, `The update to ${u.id} changes nothing; set a change or remove it.`));
    }
    const levelChange = u.changes.verification !== null;
    if (levelChange && u.add_sources.length === 0) {
      out.push(error("UPDATE_EVIDENCE", `${at}.add_sources`, `${u.id}: a change of verification needs at least one new source in add_sources.`));
    } else if (rec) {
      // The level after the update must still have its evidence, also when only damage or effect changes.
      const after = applyStrikeChanges(rec, u);
      const gaps = strikeEvidenceGaps(after.verification, [...rec.sources, ...u.add_sources], after.damage, after.effect);
      if (gaps.length) {
        const where = levelChange ? "add_sources" : u.changes.damage !== null ? "changes.damage" : u.changes.effect !== null ? "changes.effect" : "changes";
        out.push(error("UPDATE_EVIDENCE", `${at}.${where}`, `${u.id} at verification ${after.verification} lacks ${gaps.join("; ")}.`));
      }
    }
  });
  return out;
};

export const recordRules: Rule = (r) => [...ids(r), ...recordFields(r), ...incidents(r), ...strikes(r), ...updates(r)];

