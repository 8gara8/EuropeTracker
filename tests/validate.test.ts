import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pathwayCounts } from "@/lib/aggregate";
import { addDays } from "@/lib/dates";
import { loadContent } from "@/lib/content";
import { buildContext } from "@/lib/context";
import { DRAFT_SCHEMA_PATH, renderDraftSchema } from "@/lib/json-schema";
import { totalWords } from "@/lib/rules/words";
import { AgentContext } from "@/lib/schema/context";
import type { Brief } from "@/lib/schema/brief";
import type { DraftBrief, IncidentUpdate, StrikeUpdate } from "@/lib/schema/draft-brief";
import type { Incident } from "@/lib/schema/incident";
import { validateAll, validateDraft, validatePublished, worldFromContext, type World } from "@/lib/validate";

const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const weekday = () => read("fixtures/briefs/valid-weekday.json") as DraftBrief;
const weekdayContext = () => AgentContext.parse(read("fixtures/context/weekday.json"));
const weekdayEvidence = () => read("fixtures/evidence/weekday.json").urls as string[];

/** The published form of a draft; `computed.pathways` comes from the incidents added by its date. */
function publish(d: DraftBrief, incidents: Incident[] = [], publishedAt = "2026-10-28T06:10:00+08:00"): Brief {
  const counts = pathwayCounts(incidents.filter((x) => x.added <= d.date), d.date);
  return {
    ...d,
    published_at: publishedAt,
    computed: {
      pathways: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { incidents_30d: v.incidents_30d, baseline_monthly: v.baseline_monthly }])) as Brief["computed"]["pathways"],
      word_count: totalWords(d),
      source_count: d.sources.length,
      source_category_count: new Set(d.sources.map((s) => s.category)).size,
    },
  };
}

describe("schema errors", () => {
  it("report every issue with its path and still run the rules elsewhere", () => {
    const d = weekday() as unknown as Record<string, unknown>;
    delete d.title;
    (d.board as DraftBrief["board"]).ladder.previous_rung = 2;
    const r = validateDraft(d, { context: weekdayContext(), evidence: weekdayEvidence() });
    const schema = r.errors.filter((e) => e.code === "SCHEMA");
    expect(schema).toHaveLength(1);
    expect(schema[0]!.path).toBe("title");
    expect(schema[0]!.message).toMatch(/Missing key/);
    expect(r.errors.map((e) => e.code)).toContain("RUNG_PREVIOUS");
    expect(r.draft).toBeNull();
  });

  it("name unknown keys individually", () => {
    const d = weekday();
    (d.board.pathways[2] as unknown as Record<string, unknown>).note = "x";
    const r = validateDraft(d, { context: weekdayContext(), evidence: weekdayEvidence() });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ code: "SCHEMA", path: "board.pathways[2].note" });
  });

  it("handle input that isn't an object", () => {
    const r = validateDraft([], { context: weekdayContext() });
    expect(r.ok).toBe(false);
    expect(r.errors.every((e) => e.code === "SCHEMA")).toBe(true);
  });
});

describe("rules beyond the fixtures", () => {
  it("rejects a forecast that would push open forecasts past 30", () => {
    const ctx = weekdayContext();
    const extra = Array.from({ length: 27 }, (_, i) => ({ ...ctx.open_forecasts[0]!, id: `F-2026-${String(100 + i)}` }));
    ctx.open_forecasts.push(...extra);
    const r = validateDraft(weekday(), { context: ctx, evidence: weekdayEvidence() });
    expect([...new Set(r.errors.map((e) => e.code))]).toEqual(["FORECAST_OPEN_CAP"]);
  });

  it("checks the Monday assumptions list", () => {
    const d = read("fixtures/briefs/valid-monday.json") as DraftBrief;
    d.weekly_outlook!.assumptions_check.pop();
    const r = validateDraft(d, { context: AgentContext.parse(read("fixtures/context/monday.json")), evidence: read("fixtures/evidence/monday.json").urls });
    expect([...new Set(r.errors.map((e) => e.code))]).toEqual(["WEEKLY_ASSUMPTIONS"]);
  });

  it("flags a deadly incident that isn't marked serious", () => {
    const d = weekday();
    Object.assign(d.incidents_new[0]!, { rung: 4, serious: false, casualties: { killed: 1, injured: 0 } });
    const r = validateDraft(d, { context: weekdayContext(), evidence: weekdayEvidence() });
    expect(r.errors.map((e) => e.code)).toContain("INCIDENT_SERIOUS");
  });

  it("accepts a source cited through a Wayback snapshot of an evidence URL", () => {
    const d = weekday();
    d.sources[12]!.url = `https://web.archive.org/web/20261028000000/${d.sources[12]!.url}`;
    const r = validateDraft(d, { context: weekdayContext(), evidence: weekdayEvidence() });
    expect(r.ok).toBe(true);
  });
});

describe("record updates", () => {
  type Ctx = ReturnType<typeof weekdayContext>;
  const incidentUpdate = (changes: Partial<IncidentUpdate["changes"]>, addSources: IncidentUpdate["add_sources"] = []): IncidentUpdate => ({
    id: "INC-2026-0118",
    changes: { attribution: null, attribution_note: null, rung: null, serious: null, casualties: null, disruption_hours: null, summary: null, ...changes },
    add_sources: addSources,
    reason: "SAMPLE: officials reported casualties from the incursion.",
  });
  const strikeUpdate = (changes: Partial<StrikeUpdate["changes"]>, addSources: StrikeUpdate["add_sources"] = []): StrikeUpdate => ({
    id: "STR-2026-0450",
    changes: { verification: null, damage: null, effect: null, summary: null, weapon_detail: null, western_weapon: null, ...changes },
    add_sources: addSources,
    reason: "SAMPLE: new imagery of the site.",
  });
  /** The context's world with INC-2026-0118 as a full rung-3 record without deaths. */
  const fullWorld = (ctx: Ctx): World => {
    const world = worldFromContext(ctx);
    const brief = world.incidents.find((x) => x.id === "INC-2026-0118")!;
    const full: Incident = {
      ...brief, date_precision: "day", location_country: "PL", location: "Lublin Voivodeship", sea: null, serious: false,
      attribution_note: null, host_statement: "yes", casualties: { killed: 0, injured: 0 }, disruption_hours: null,
      sources: [weekday().incidents_new[0]!.sources[0]!], seed: false, added: brief.date, updated: null,
    };
    return { ...world, incidents: world.incidents.map((x) => (x.id === full.id ? full : x)) };
  };

  it("reject deaths added below rung 4, on full and on context-only records", () => {
    const ctx = weekdayContext();
    expect(validateDraft(weekday(), { context: ctx, world: fullWorld(ctx), evidence: weekdayEvidence() }).errors).toEqual([]);
    const d = weekday();
    d.incident_updates.push(incidentUpdate({ casualties: { killed: 1, injured: 0 }, serious: true }));
    for (const world of [fullWorld(ctx), worldFromContext(ctx)]) {
      const r = validateDraft(d, { context: ctx, world, evidence: weekdayEvidence() });
      expect(r.ok).toBe(false);
      expect(r.errors).toContainEqual(expect.objectContaining({ code: "INCIDENT_RUNG", path: "incident_updates[1].changes.rung" }));
    }
  });

  it("accept deaths at rung 4 with a new source and a board to match", () => {
    const ctx = weekdayContext();
    const d = weekday();
    const s = d.sources[0]!;
    d.incident_updates.push(incidentUpdate({ rung: 4, casualties: { killed: 1, injured: 0 }, serious: true },
      [{ title: s.title, outlet: s.outlet, category: s.category, url: s.url, published_at: s.published_at }]));
    d.board.ladder.current_rung = 4;
    Object.assign(d.board.countries.find((c) => c.country === "PL")!, { score: 4, reason: "SAMPLE: a death in the Lublin incursion raises the floor to 4.", source_ids: [s.id] });
    expect(validateDraft(d, { context: ctx, world: fullWorld(ctx), evidence: weekdayEvidence() }).errors).toEqual([]);
  });

  it("allow injuries at rung 3", () => {
    const ctx = weekdayContext();
    const d = weekday();
    d.incident_updates.push(incidentUpdate({ casualties: { killed: 0, injured: 2 } }));
    const r = validateDraft(d, { context: ctx, world: fullWorld(ctx), evidence: weekdayEvidence() });
    expect(r.errors.filter((e) => e.code === "INCIDENT_RUNG")).toEqual([]);
  });

  it.each(["", "   "])("reject a level-4 strike whose damage becomes %j", (damage) => {
    const d = weekday();
    d.strike_updates.push(strikeUpdate({ damage }));
    const r = validateDraft(d, { context: weekdayContext(), evidence: weekdayEvidence() });
    const issue = r.errors.find((e) => e.code === "UPDATE_EVIDENCE");
    expect(issue).toMatchObject({ path: "strike_updates[1].changes.damage" });
    expect(issue!.message).toMatch(/damage description/);
  });

  it.each(["", "   "])("reject a level-5 strike whose effect becomes %j", (effect) => {
    const ctx = weekdayContext();
    const world = worldFromContext(ctx);
    world.strikes = world.strikes.map((s) => (s.id === "STR-2026-0450" ? { ...s, verification: 5 as const, effect: "SAMPLE: crude processing stopped for two weeks." } : s));
    expect(validateDraft(weekday(), { context: ctx, world, evidence: weekdayEvidence() }).errors).toEqual([]);
    const d = weekday();
    d.strike_updates.push(strikeUpdate({ effect }));
    const r = validateDraft(d, { context: ctx, world, evidence: weekdayEvidence() });
    expect(r.errors).toContainEqual(expect.objectContaining({ code: "UPDATE_EVIDENCE", path: "strike_updates[1].changes.effect" }));
  });

  it("accept a new damage description without new sources, but not a level change without them", () => {
    const d = weekday();
    d.strike_updates.push(strikeUpdate({ damage: "SAMPLE: satellite images show two burned distillation units." }));
    expect(validateDraft(d, { context: weekdayContext(), evidence: weekdayEvidence() }).errors).toEqual([]);
    const e = weekday();
    e.strike_updates.push(strikeUpdate({ verification: 5, effect: "SAMPLE: processing stopped." }));
    const r = validateDraft(e, { context: weekdayContext(), evidence: weekdayEvidence() });
    expect(r.errors).toContainEqual(expect.objectContaining({ code: "UPDATE_EVIDENCE", path: "strike_updates[1].add_sources" }));
  });
});

describe("validatePublished", () => {
  it("accepts a brief with correct computed fields", () => {
    const r = validatePublished(publish(weekday()), { fileDate: "2026-10-28" });
    expect(r.errors).toEqual([]);
  });

  it("checks forecast-resolution citations without a context", () => {
    const monday = () => publish(read("fixtures/briefs/valid-monday.json") as DraftBrief, [], "2026-10-26T06:10:00+08:00");
    expect(validatePublished(monday(), { fileDate: "2026-10-26" }).errors).toEqual([]);
    const b = monday();
    b.forecast_resolutions[0]!.source_id = "s999";
    const r = validatePublished(b);
    expect(r.ok).toBe(false);
    expect(r.errors).toContainEqual(expect.objectContaining({ code: "FORECAST_REF", path: "forecast_resolutions[0].source_id" }));
    expect(validatePublished(b, { prefix: "briefs/2026-10-26.json" }).errors)
      .toContainEqual(expect.objectContaining({ code: "FORECAST_REF", path: "briefs/2026-10-26.json: forecast_resolutions[0].source_id" }));
  });

  it("reports a bad resolution citation once in a draft", () => {
    const d = read("fixtures/briefs/valid-monday.json") as DraftBrief;
    d.forecast_resolutions[0]!.source_id = "s999";
    const r = validateDraft(d, { context: AgentContext.parse(read("fixtures/context/monday.json")), evidence: read("fixtures/evidence/monday.json").urls });
    expect(r.errors.filter((e) => e.path === "forecast_resolutions[0].source_id")).toHaveLength(1);
  });

  it("catches computed fields that don't match the brief", () => {
    const b = publish(weekday());
    b.computed.word_count += 1;
    const r = validatePublished(b);
    expect(r.errors.map((e) => e.code)).toEqual(["COMPUTED_MISMATCH"]);
  });
});

describe("validateAll", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

  const copyContent = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "et-content-"));
    dirs.push(dir);
    fs.cpSync("content", dir, { recursive: true });
    return dir;
  };

  it("passes the committed content", () => {
    expect(validateAll("content").errors).toEqual([]);
  });

  it("finds cross-file problems", () => {
    const dir = copyContent();
    const incident = { ...weekday().incidents_new[0]!, added: "2026-10-28" };
    const write = (f: string, v: unknown) => fs.writeFileSync(path.join(dir, f), JSON.stringify(v));
    const in2026 = [incident, { ...incident, date: "2026-10-01" }];
    const in2025 = [{ ...incident, date: "2025-12-01" }];
    write("incidents/2026.json", { schema_version: 1, year: 2026, incidents: in2026 });
    write("incidents/2025.json", { schema_version: 1, year: 2025, incidents: in2025 });
    write("briefs/2026-10-29.json", publish(weekday(), [...in2026, ...in2025]));
    const codes = new Set(validateAll(dir).errors.map((e) => e.code));
    expect(codes).toEqual(new Set(["XREF_ID_DUP", "FILE_ORDER", "XREF_ID_YEAR", "DATE_MISMATCH", "XREF_UNRESOLVED"]));
  });

  it("checks published pathway counts against the incidents added by then", () => {
    const dir = copyContent();
    const quiet = read("fixtures/briefs/valid-quiet.json") as DraftBrief;
    const D = quiet.date;
    const base = weekday().incidents_new[0]!;
    const mk = (n: number, date: string, added = date): Incident => ({ ...base, id: `INC-2026-${String(n).padStart(4, "0")}`, date, added });
    // 30-day window [D-29, D]; baseline window [D-119, D-30]; D-120 counts in neither.
    const incidents = [mk(1, addDays(D, -120)), mk(2, addDays(D, -119)), mk(3, addDays(D, -75)), mk(4, addDays(D, -30)), mk(5, addDays(D, -29))];
    const write = (f: string, v: unknown) => fs.writeFileSync(path.join(dir, f), JSON.stringify(v));
    const writeIncidents = (list: Incident[]) => write("incidents/2026.json", { schema_version: 1, year: 2026, incidents: list });
    const brief = () => publish(quiet, incidents, `${D}T06:10:00+08:00`);
    writeIncidents(incidents);
    expect(brief().computed.pathways.airspace).toEqual({ incidents_30d: 1, baseline_monthly: 1 });
    write(`briefs/${D}.json`, brief());
    expect(validateAll(dir).errors).toEqual([]);

    for (const [field, expected] of [["incidents_30d", 1], ["baseline_monthly", 1]] as const) {
      const b = brief();
      b.computed.pathways.airspace[field] = 999;
      write(`briefs/${D}.json`, b);
      const errors = validateAll(dir).errors;
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ code: "COMPUTED_MISMATCH", path: `briefs/${D}.json: computed.pathways.airspace.${field}` });
      expect(errors[0]!.message).toContain(`give ${expected}`);
    }

    // A record backfilled after publication doesn't change the old snapshot.
    write(`briefs/${D}.json`, brief());
    writeIncidents([...incidents, mk(6, addDays(D, -10), addDays(D, 5))]);
    expect(validateAll(dir).errors).toEqual([]);
  });

  it("reports files that aren't JSON", () => {
    const dir = copyContent();
    fs.writeFileSync(path.join(dir, "forecasts.json"), "{ nope");
    expect(validateAll(dir).errors[0]).toMatchObject({ code: "SCHEMA", path: "forecasts.json" });
  });
});

describe("context and schema files", () => {
  it("builds a valid agent context from the committed content", () => {
    const content = loadContent("content", { fresh: true });
    const ctx = buildContext(content, "2026-11-03");
    expect(AgentContext.safeParse(ctx).success).toBe(true);
    const taken = new Set([...content.incidents, ...content.strikes, ...content.forecasts].map((x) => x.id));
    const next = [ctx.next_ids.incident["2026"], ctx.next_ids.strike["2026"], ctx.next_ids.forecast];
    expect(next.every((id) => id !== undefined && !taken.has(id))).toBe(true);
    expect(ctx.window).toEqual({ start: "2026-11-02T05:30:00+08:00", end: "2026-11-03T05:30:00+08:00" });
  });

  it("keeps the committed agent JSON Schema current", () => {
    expect(fs.readFileSync(DRAFT_SCHEMA_PATH, "utf8")).toBe(renderDraftSchema());
  });
});
