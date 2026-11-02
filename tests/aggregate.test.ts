import { describe, expect, it } from "vitest";
import { brier, brierSummary, computedRung, countryFloors, floorForRung, monthlyCounts, nextIds, pathwayCounts } from "@/lib/aggregate";
import type { Forecast } from "@/lib/schema/forecast";
import type { Incident } from "@/lib/schema/incident";

type Inc = Pick<Incident, "id" | "date" | "rung" | "pathway" | "serious" | "affected">;
const inc = (id: string, date: string, rung: Incident["rung"], pathway: Incident["pathway"] = "airspace", affected: Incident["affected"] = ["PL"], serious = false): Inc =>
  ({ id, date, rung, pathway, serious, affected });

describe("computedRung", () => {
  const incidents = [inc("INC-2026-0001", "2026-10-03", 4), inc("INC-2026-0002", "2026-10-05", 3), inc("INC-2026-0003", "2026-11-03", 5)];
  it("takes the highest rung dated in [asOf − 29, asOf]", () => {
    expect(computedRung(incidents, "2026-11-02")).toBe(3); // 10-03 is 30 days back: out; 10-05 in; 11-03 is in the future
    expect(computedRung(incidents, "2026-11-01")).toBe(4);
  });
  it("is 0 with no incidents in the window", () => {
    expect(computedRung(incidents, "2027-01-01")).toBe(0);
    expect(computedRung([], "2026-11-02")).toBe(0);
  });
});

describe("pathwayCounts", () => {
  const incidents = [
    inc("a", "2026-10-30", 3), inc("b", "2026-10-10", 3), // last 30 days
    inc("c", "2026-09-01", 3), inc("d", "2026-08-01", 3), inc("e", "2026-07-10", 3), inc("f", "2026-07-01", 3), // baseline window [07-06, 10-03]
    inc("g", "2025-12-01", 4, "airspace", ["PL"], true),
    inc("h", "2026-10-20", 2, "sabotage", ["DE"]),
  ];
  const c = pathwayCounts(incidents, "2026-11-02");
  it("counts the last 30 days and the 90-day baseline", () => {
    expect(c.airspace.incidents_30d).toBe(2);
    expect(c.airspace.baseline_monthly).toBe(1); // c, d, e in [07-06, 10-03]; f is before
    expect(c.sabotage.incidents_30d).toBe(1);
    expect(c.maritime).toEqual({ incidents_30d: 0, baseline_monthly: 0, serious_12m: 0, monthly_avg_since_2022: 0 });
  });
  it("counts serious incidents in 12 months and the average since February 2022", () => {
    expect(c.airspace.serious_12m).toBe(1);
    expect(c.airspace.monthly_avg_since_2022).toBe(0.1); // 7 incidents over about 56 months
  });
});

describe("countryFloors", () => {
  const floors = countryFloors([
    inc("a", "2026-10-30", 1, "cyber_ew", ["EE", "LV"]),
    inc("b", "2026-10-29", 3, "airspace", ["PL", "LT"]),
    inc("c", "2026-10-28", 2, "sabotage", ["LT"]),
    inc("d", "2026-09-01", 4, "airspace", ["RO"]),
  ], "2026-11-02");
  it("maps the highest rung affecting each country to its floor", () => {
    expect(floors.EE).toEqual({ max_rung_30d: 1, floor: 2 });
    expect(floors.PL).toEqual({ max_rung_30d: 3, floor: 3 });
    expect(floors.LT).toEqual({ max_rung_30d: 3, floor: 3 });
    expect(floors.RO).toEqual({ max_rung_30d: 0, floor: 1 }); // outside the window
    expect(floors.FI.floor).toBe(1);
  });
  it("follows the anchors", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(floorForRung)).toEqual([1, 2, 3, 3, 4, 5, 5]);
  });
});

describe("monthlyCounts", () => {
  it("fills every month from February 2022 with per-pathway counts", () => {
    const rows = monthlyCounts([inc("a", "2022-03-05", 3), inc("b", "2022-03-20", 2, "sabotage"), inc("c", "2022-05-01", 3)]);
    expect(rows.map((r) => r.month)).toEqual(["2022-02", "2022-03", "2022-04", "2022-05"]);
    expect(rows[1]!.counts).toEqual({ airspace: 1, sabotage: 1 });
    expect(rows[2]!.counts).toEqual({});
  });
});

describe("nextIds", () => {
  it("continues each year's sequence, padding ids", () => {
    const ids = nextIds(
      [{ id: "INC-2025-0164" }, { id: "INC-2026-0130" }, { id: "INC-2026-0009" }],
      [{ id: "STR-2026-0456" }],
      [{ id: "F-2026-013" }, { id: "F-2025-040" }],
      "2026-11-02",
    );
    expect(ids).toEqual({
      incident: { "2025": "INC-2025-0165", "2026": "INC-2026-0131" },
      strike: { "2025": "STR-2025-0001", "2026": "STR-2026-0457" },
      forecast: "F-2026-014",
    });
  });
  it("starts a new year at 1", () => {
    expect(nextIds([{ id: "INC-2026-0131" }], [], [{ id: "F-2026-020" }], "2027-01-01")).toEqual({
      incident: { "2026": "INC-2026-0132", "2027": "INC-2027-0001" },
      strike: { "2026": "STR-2026-0001", "2027": "STR-2027-0001" },
      forecast: "F-2027-001",
    });
  });
});

describe("brier", () => {
  const f = (status: Forecast["status"], probability: number, base_rate: number, updates: number[] = []) =>
    ({ status, probability, base_rate, updates: updates.map((p) => ({ date: "2026-11-01", probability: p, note: "" })) });
  it("scores the last probability against the outcome", () => {
    expect(brier(f("resolved_yes", 70, 60))).toEqual({ brier: 0.09, brier_base: 0.16 });
    expect(brier(f("resolved_no", 70, 60, [80, 20]))).toEqual({ brier: 0.04, brier_base: 0.36 });
  });
  it("is null for open and annulled forecasts", () => {
    expect(brier(f("open", 70, 60))).toEqual({ brier: null, brier_base: null });
    expect(brier(f("annulled", 70, 60))).toEqual({ brier: null, brier_base: null });
  });
  it("averages resolved forecasts", () => {
    const all = [f("resolved_yes", 70, 60), f("resolved_no", 70, 60, [20]), f("open", 50, 50)] as Forecast[];
    expect(brierSummary(all)).toEqual({ n: 2, mean_brier: 0.065, mean_brier_base: 0.26 });
    expect(brierSummary([])).toEqual({ n: 0, mean_brier: null, mean_brier_base: null });
  });
});
