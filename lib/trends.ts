import type { Brief } from "./schema/brief";
import type { Incident } from "./schema/incident";
import type { Strike } from "./schema/strike";
import { TIER1, type PathwayId, type ProbabilityTerm, type Rung, type Score, type Tier1Country } from "./vocab";

// Time series for the trend charts (SPEC §5, §6). The rung and the incident counts come from the incident
// database, so they exist for every day back to February 2022. Odds and country scores are the analyst's
// calls, so they exist only for days with a brief.

const DAY = 86_400_000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const dateOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

type BoardBrief = Pick<Brief, "date" | "board">;

export interface RungPoint { date: string; rung: Rung; published: boolean }

/**
 * The rung for every day from `from` to `to`. A day with a brief takes the rung it published; any other
 * day takes the highest rung of an incident dated in the 30 days up to it, the rule `computedRung` applies.
 */
export function rungHistory(incidents: Pick<Incident, "date" | "rung">[], briefs: BoardBrief[], from: string, to: string): RungPoint[] {
  const published = new Map(briefs.map((b) => [b.date, b.board.ladder.current_rung]));
  const dated = incidents.map((i) => ({ n: dayNumber(i.date), rung: i.rung })).sort((a, b) => a.n - b.n);
  const out: RungPoint[] = [];
  let lo = 0;
  let hi = 0;
  for (let n = dayNumber(from); n <= dayNumber(to); n++) {
    while (hi < dated.length && dated[hi]!.n <= n) hi++;
    while (lo < hi && dated[lo]!.n < n - 29) lo++;
    let max = 0;
    for (let k = lo; k < hi; k++) max = Math.max(max, dated[k]!.rung);
    const date = dateOf(n);
    const rung = published.get(date);
    out.push(rung === undefined ? { date, rung: max as Rung, published: false } : { date, rung, published: true });
  }
  return out;
}

/** Consecutive days at the same rung. */
export function rungRuns(points: RungPoint[]): { from: string; to: string; rung: Rung; days: number }[] {
  const runs: { from: string; to: string; rung: Rung; days: number }[] = [];
  for (const p of points) {
    const last = runs.at(-1);
    if (last && last.rung === p.rung) {
      last.to = p.date;
      last.days++;
    } else {
      runs.push({ from: p.date, to: p.date, rung: p.rung, days: 1 });
    }
  }
  return runs;
}

/** Days spent at each rung. */
export function daysAtRung(points: RungPoint[]): Partial<Record<Rung, number>> {
  const out: Partial<Record<Rung, number>> = {};
  for (const p of points) out[p.rung] = (out[p.rung] ?? 0) + 1;
  return out;
}

/** Incidents in one pathway dated in the 30 days up to each sample, sampling every `step` days back from `to`. */
export function rollingCounts(incidents: Pick<Incident, "date" | "pathway">[], pathway: PathwayId, from: string, to: string, step = 7): { date: string; count: number }[] {
  const days = incidents.filter((i) => i.pathway === pathway).map((i) => dayNumber(i.date));
  const out: { date: string; count: number }[] = [];
  for (let n = dayNumber(to); n >= dayNumber(from); n -= step) {
    out.push({ date: dateOf(n), count: days.filter((d) => d <= n && d > n - 30).length });
  }
  return out.reverse();
}

/** Incidents dated in the 365 days up to `asOf`, and in the 365 days before that. */
export function yearOnYear(incidents: Pick<Incident, "date">[], asOf: string): { last12: number; prior12: number } {
  const n = dayNumber(asOf);
  let last12 = 0;
  let prior12 = 0;
  for (const i of incidents) {
    const d = dayNumber(i.date);
    if (d <= n && d > n - 365) last12++;
    else if (d <= n - 365 && d > n - 730) prior12++;
  }
  return { last12, prior12 };
}

export interface OddsPoint { date: string; probability: number; term: ProbabilityTerm; rung: Rung }

/** Each brief's 30-day odds of an incident one rung higher; `rung` is the rung those odds are for. */
export function nextRungOdds(briefs: BoardBrief[]): OddsPoint[] {
  return briefs.flatMap((b) => {
    const { current_rung: current, next_rung_odds: odds } = b.board.ladder;
    return odds ? [{ date: b.date, probability: odds.probability, term: odds.term, rung: (current + 1) as Rung }] : [];
  });
}

/** Each brief's 30-day odds of a serious incident in one pathway. */
export function pathwayOdds(briefs: BoardBrief[], pathway: PathwayId): { date: string; probability: number; term: ProbabilityTerm }[] {
  return briefs.flatMap((b) => {
    const p = b.board.pathways.find((x) => x.pathway === pathway);
    return p ? [{ date: b.date, probability: p.serious_odds.probability, term: p.serious_odds.term }] : [];
  });
}

export interface ScoreRow { country: Tier1Country; points: { date: string; score: Score }[] }

/** Each frontline country's score in every brief. */
export function scoreHistory(briefs: BoardBrief[]): ScoreRow[] {
  return TIER1.map((country) => ({
    country,
    points: briefs.flatMap((b) => {
      const c = b.board.countries.find((x) => x.country === country);
      return c ? [{ date: b.date, score: c.score }] : [];
    }),
  }));
}

/** Score changes, as each brief recorded them against the score before it. */
export function scoreChanges(briefs: BoardBrief[]): { date: string; country: Tier1Country; from: Score; to: Score }[] {
  return briefs.flatMap((b) => b.board.countries
    .filter((c) => (TIER1 as readonly string[]).includes(c.country) && c.previous_score !== null && c.previous_score !== c.score)
    .map((c) => ({ date: b.date, country: c.country as Tier1Country, from: c.previous_score!, to: c.score })));
}

/** Strikes per week (weeks start on Monday) from the first strike's week to the week of `to`, with empty weeks. */
export function weeklyCounts(strikes: Pick<Strike, "date">[], to: string): { week: string; count: number }[] {
  const monday = (n: number) => n - ((new Date(n * DAY).getUTCDay() + 6) % 7);
  const dated = strikes.map((s) => dayNumber(s.date)).filter((n) => n <= dayNumber(to));
  if (!dated.length) return [];
  const counts = new Map<number, number>();
  for (const n of dated) counts.set(monday(n), (counts.get(monday(n)) ?? 0) + 1);
  const out: { week: string; count: number }[] = [];
  for (let w = monday(Math.min(...dated)); w <= monday(dayNumber(to)); w += 7) out.push({ week: dateOf(w), count: counts.get(w) ?? 0 });
  return out;
}

/** One brief metric by date; null where a brief didn't report it. */
export function metricHistory(briefs: Pick<Brief, "date" | "metrics">[], id: string): { date: string; value: number | null }[] {
  return briefs.map((b) => ({ date: b.date, value: b.metrics.find((m) => m.id === id)?.value ?? null }));
}
