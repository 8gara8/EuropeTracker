import { addDays, daysBetween, inRange, monthOf, monthsBetween, yearOf } from "./dates";
import type { Forecast } from "./schema/forecast";
import type { Incident } from "./schema/incident";
import type { Strike } from "./schema/strike";
import { COUNTRIES, PATHWAYS, SEED_START, type CountryCode, type PathwayId, type Rung, type Score } from "./vocab";

// Pure aggregate functions shared by the site, the validator and the context builder (SPEC §7.4).
// "Last 30 days" means dates in [asOf − 29, asOf].

type Dated = Pick<Incident, "date">;

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export function last30(asOf: string): { from: string; to: string } {
  return { from: addDays(asOf, -29), to: asOf };
}

export function inLast30(item: Dated, asOf: string): boolean {
  return inRange(item.date, addDays(asOf, -29), asOf);
}

/** The highest rung of any incident dated in the last 30 days, or 0. */
export function computedRung(incidents: Pick<Incident, "date" | "rung">[], asOf: string): Rung {
  let max = 0;
  for (const i of incidents) {
    if (inLast30(i, asOf) && i.rung > max) max = i.rung;
  }
  return max as Rung;
}

export interface PathwayCounts {
  incidents_30d: number;
  baseline_monthly: number;
  serious_12m: number;
  monthly_avg_since_2022: number;
}

export function pathwayCounts(
  incidents: Pick<Incident, "date" | "pathway" | "serious">[],
  asOf: string,
): Record<PathwayId, PathwayCounts> {
  const from30 = addDays(asOf, -29);
  const baseFrom = addDays(asOf, -119);
  const baseTo = addDays(asOf, -30);
  const from12m = addDays(asOf, -364);
  const monthsSince2022 = Math.max(daysBetween(SEED_START, asOf), 1) / (365.25 / 12);

  const out = {} as Record<PathwayId, PathwayCounts>;
  for (const p of PATHWAYS) {
    const mine = incidents.filter((i) => i.pathway === p && i.date <= asOf);
    out[p] = {
      incidents_30d: mine.filter((i) => i.date >= from30).length,
      baseline_monthly: round(mine.filter((i) => inRange(i.date, baseFrom, baseTo)).length / 3, 1),
      serious_12m: mine.filter((i) => i.serious && i.date >= from12m).length,
      monthly_avg_since_2022: round(mine.filter((i) => i.date >= SEED_START).length / monthsSince2022, 1),
    };
  }
  return out;
}

/** The country-score floor for a 30-day maximum rung (STYLE.md §8). */
export function floorForRung(maxRung: number): Score {
  if (maxRung >= 5) return 5;
  if (maxRung === 4) return 4;
  if (maxRung >= 2) return 3;
  if (maxRung === 1) return 2;
  return 1;
}

export function countryFloors(
  incidents: Pick<Incident, "date" | "rung" | "affected">[],
  asOf: string,
): Record<CountryCode, { max_rung_30d: number; floor: Score }> {
  const max = Object.fromEntries(COUNTRIES.map((c) => [c, 0])) as Record<CountryCode, number>;
  for (const i of incidents) {
    if (!inLast30(i, asOf)) continue;
    for (const c of i.affected) {
      if (c in max && i.rung > max[c]) max[c] = i.rung;
    }
  }
  const out = {} as Record<CountryCode, { max_rung_30d: number; floor: Score }>;
  for (const c of COUNTRIES) out[c] = { max_rung_30d: max[c], floor: floorForRung(max[c]) };
  return out;
}

/** Incident counts per month and pathway, from February 2022 to `through` (default: the latest month). */
export function monthlyCounts(
  incidents: Pick<Incident, "date" | "pathway">[],
  through?: string,
): { month: string; counts: Partial<Record<PathwayId, number>> }[] {
  const dated = incidents.filter((i) => i.date >= SEED_START);
  const last = through ?? dated.reduce((m, i) => (i.date > m ? i.date : m), SEED_START);
  const rows = new Map(monthsBetween(SEED_START, last).map((m) => [m, {} as Partial<Record<PathwayId, number>>]));
  for (const i of dated) {
    const row = rows.get(monthOf(i.date));
    if (row) row[i.pathway] = (row[i.pathway] ?? 0) + 1;
  }
  return [...rows].map(([month, counts]) => ({ month, counts }));
}

/** Brier scores for a resolved forecast; null when it is open or annulled (SPEC §4.9). */
export function brier(forecast: Pick<Forecast, "status" | "probability" | "base_rate" | "updates">): {
  brier: number | null;
  brier_base: number | null;
} {
  if (forecast.status !== "resolved_yes" && forecast.status !== "resolved_no") return { brier: null, brier_base: null };
  const outcome = forecast.status === "resolved_yes" ? 1 : 0;
  const last = forecast.updates.at(-1)?.probability ?? forecast.probability;
  return {
    brier: round((last / 100 - outcome) ** 2, 4),
    brier_base: round((forecast.base_rate / 100 - outcome) ** 2, 4),
  };
}

export function brierSummary(forecasts: Forecast[]): { n: number; mean_brier: number | null; mean_brier_base: number | null } {
  const scored = forecasts.map(brier).filter((b): b is { brier: number; brier_base: number } => b.brier !== null);
  if (scored.length === 0) return { n: 0, mean_brier: null, mean_brier_base: null };
  const mean = (xs: number[]) => round(xs.reduce((a, b) => a + b, 0) / xs.length, 4);
  return { n: scored.length, mean_brier: mean(scored.map((s) => s.brier)), mean_brier_base: mean(scored.map((s) => s.brier_base)) };
}

const ID_SEQ_RE = /^(INC|STR)-(\d{4})-(\d{4})$/;
const FORECAST_SEQ_RE = /^F-(\d{4})-(\d{3})$/;

function maxSeq(ids: string[], prefix: "INC" | "STR", year: number): number {
  let max = 0;
  for (const id of ids) {
    const m = ID_SEQ_RE.exec(id);
    if (m && m[1] === prefix && Number(m[2]) === year) max = Math.max(max, Number(m[3]));
  }
  return max;
}

/** The next free ids: incidents and strikes for the date's year and the year before; forecasts for the date's year. */
export function nextIds(
  incidents: Pick<Incident, "id">[],
  strikes: Pick<Strike, "id">[],
  forecasts: Pick<Forecast, "id">[],
  date: string,
): { incident: Record<string, string>; strike: Record<string, string>; forecast: string } {
  const year = yearOf(date);
  const incident: Record<string, string> = {};
  const strike: Record<string, string> = {};
  for (const y of [year - 1, year]) {
    incident[String(y)] = `INC-${y}-${String(maxSeq(incidents.map((i) => i.id), "INC", y) + 1).padStart(4, "0")}`;
    strike[String(y)] = `STR-${y}-${String(maxSeq(strikes.map((s) => s.id), "STR", y) + 1).padStart(4, "0")}`;
  }
  let maxForecast = 0;
  for (const f of forecasts) {
    const m = FORECAST_SEQ_RE.exec(f.id);
    if (m && Number(m[1]) === year) maxForecast = Math.max(maxForecast, Number(m[2]));
  }
  return { incident, strike, forecast: `F-${year}-${String(maxForecast + 1).padStart(3, "0")}` };
}

/** Splits "INC-2026-0131" into its year and sequence number; null when malformed. */
export function parseRecordId(id: string): { kind: "INC" | "STR"; year: number; seq: number } | null {
  const m = ID_SEQ_RE.exec(id);
  return m ? { kind: m[1] as "INC" | "STR", year: Number(m[2]), seq: Number(m[3]) } : null;
}

export function parseForecastId(id: string): { year: number; seq: number } | null {
  const m = FORECAST_SEQ_RE.exec(id);
  return m ? { year: Number(m[1]), seq: Number(m[2]) } : null;
}
