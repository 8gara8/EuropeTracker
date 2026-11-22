import { describe, expect, it } from "vitest";
import { computedRung, pathwayCounts } from "@/lib/aggregate";
import { addDays } from "@/lib/dates";
import type { Brief } from "@/lib/schema/brief";
import type { Incident } from "@/lib/schema/incident";
import {
  daysAtRung, metricHistory, nextRungOdds, pathwayOdds, rollingCounts, rungHistory, rungRuns, scoreChanges, scoreHistory, weeklyCounts, yearOnYear,
} from "@/lib/trends";
import type { PathwayId } from "@/lib/vocab";

type Inc = Pick<Incident, "date" | "rung" | "pathway" | "serious">;
const inc = (date: string, rung: number, pathway: PathwayId = "airspace"): Inc => ({ date, rung: rung as Incident["rung"], pathway, serious: false });

/** A brief with just the board fields the trend functions read. */
function brief(date: string, rung: number, opts: {
  odds?: number | null;
  pathways?: Partial<Record<PathwayId, number>>;
  countries?: { country: string; score: number; previous_score: number | null }[];
  metrics?: { id: string; value: number }[];
} = {}): Brief {
  return {
    date,
    board: {
      ladder: { current_rung: rung, previous_rung: rung, next_rung_odds: opts.odds === null ? null : { term: "remote", probability: opts.odds ?? 5, confidence: "moderate" }, rationale: "" },
      pathways: Object.entries(opts.pathways ?? {}).map(([pathway, probability]) => ({ pathway, serious_odds: { term: "unlikely", probability, confidence: "moderate" } })),
      countries: opts.countries ?? [],
    },
    metrics: opts.metrics ?? [],
  } as unknown as Brief;
}

describe("rungHistory", () => {
  const incidents = [inc("2026-01-01", 3), inc("2026-01-20", 4), inc("2026-03-05", 2)];

  it("gives the highest rung in the previous 30 days, as computedRung does, on every day", () => {
    const points = rungHistory(incidents, [], "2025-12-25", "2026-04-10");
    expect(points).toHaveLength(107);
    for (const p of points) expect(p.rung).toBe(computedRung(incidents, p.date));
    expect(points.find((p) => p.date === "2026-02-18")!.rung).toBe(4);
    expect(points.find((p) => p.date === "2026-02-19")!.rung).toBe(0);
    expect(points.every((p) => !p.published)).toBe(true);
  });

  it("takes the published rung on days with a brief", () => {
    const points = rungHistory(incidents, [brief("2026-01-10", 2)], "2026-01-09", "2026-01-11");
    expect(points.map((p) => [p.rung, p.published])).toEqual([[3, false], [2, true], [3, false]]);
  });

  it("groups days into runs and counts days at each rung", () => {
    const points = rungHistory(incidents, [], "2025-12-31", "2026-01-21");
    expect(rungRuns(points)).toEqual([
      { from: "2025-12-31", to: "2025-12-31", rung: 0, days: 1 },
      { from: "2026-01-01", to: "2026-01-19", rung: 3, days: 19 },
      { from: "2026-01-20", to: "2026-01-21", rung: 4, days: 2 },
    ]);
    expect(daysAtRung(points)).toEqual({ 0: 1, 3: 19, 4: 2 });
  });
});

describe("rollingCounts", () => {
  const incidents = [inc("2026-01-01", 3), inc("2026-01-30", 3), inc("2026-01-31", 3, "sabotage"), inc("2026-02-15", 3)];

  it("samples every week back from the last day and matches the 30-day count", () => {
    const points = rollingCounts(incidents, "airspace", "2026-01-01", "2026-03-01");
    expect(points.at(-1)!.date).toBe("2026-03-01");
    expect(points[0]!.date).toBe("2026-01-04");
    for (const p of points) expect(p.count).toBe(pathwayCounts(incidents, p.date).airspace.incidents_30d);
  });
});

describe("yearOnYear", () => {
  it("counts the last 365 days and the 365 before them", () => {
    const incidents = [inc("2026-11-22", 3), inc("2025-11-23", 3), inc("2025-11-22", 3), inc("2024-11-23", 3), inc("2024-11-22", 3)];
    expect(yearOnYear(incidents, "2026-11-22")).toEqual({ last12: 2, prior12: 2 });
  });
});

describe("odds, scores and metrics from briefs", () => {
  const briefs = [
    brief("2026-11-20", 4, { odds: 5, pathways: { sabotage: 25 }, countries: [{ country: "PL", score: 2, previous_score: 2 }, { country: "DE", score: 2, previous_score: null }], metrics: [{ id: "ru_drones_launched", value: 120 }] }),
    brief("2026-11-21", 4, { odds: 5, pathways: { sabotage: 35 }, countries: [{ country: "PL", score: 3, previous_score: 2 }] }),
    brief("2026-11-22", 3, { odds: 35, pathways: { sabotage: 35 }, countries: [{ country: "PL", score: 3, previous_score: 3 }], metrics: [{ id: "ru_drones_launched", value: 98 }] }),
    brief("2026-11-23", 6, { odds: null }),
  ];

  it("labels each next-rung probability with the rung it is for, and skips rung 6", () => {
    expect(nextRungOdds(briefs).map((p) => [p.date, p.probability, p.rung])).toEqual([["2026-11-20", 5, 5], ["2026-11-21", 5, 5], ["2026-11-22", 35, 4]]);
  });

  it("reads a pathway's odds from each brief that has it", () => {
    expect(pathwayOdds(briefs, "sabotage").map((p) => p.probability)).toEqual([25, 35, 35]);
  });

  it("keeps the frontline countries in order and finds score changes", () => {
    const rows = scoreHistory(briefs);
    expect(rows.map((r) => r.country)).toEqual(["PL", "LT", "LV", "EE", "FI", "RO", "MD"]);
    expect(rows[0]!.points.map((p) => p.score)).toEqual([2, 3, 3]);
    expect(rows[1]!.points).toEqual([]);
    expect(scoreChanges(briefs)).toEqual([{ date: "2026-11-21", country: "PL", from: 2, to: 3 }]);
  });

  it("gives null where a brief didn't report a metric", () => {
    expect(metricHistory(briefs, "ru_drones_launched").map((m) => m.value)).toEqual([120, null, 98, null]);
  });
});

describe("weeklyCounts", () => {
  it("counts strikes in Monday weeks, keeps empty weeks and stops at the last day", () => {
    const strikes = [{ date: "2026-11-02" }, { date: "2026-11-08" }, { date: "2026-11-18" }, { date: "2026-11-30" }];
    expect(weeklyCounts(strikes, "2026-11-22")).toEqual([
      { week: "2026-11-02", count: 2 },
      { week: "2026-11-09", count: 0 },
      { week: "2026-11-16", count: 1 },
    ]);
    expect(weeklyCounts([], "2026-11-22")).toEqual([]);
  });

  it("starts on the Monday of the first strike's week", () => {
    expect(weeklyCounts([{ date: "2026-11-05" }], addDays("2026-11-05", 1))[0]!.week).toBe("2026-11-02");
  });
});
