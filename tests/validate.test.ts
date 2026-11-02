import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pathwayCounts } from "@/lib/aggregate";
import { loadContent } from "@/lib/content";
import { buildContext } from "@/lib/context";
import { DRAFT_SCHEMA_PATH, renderDraftSchema } from "@/lib/json-schema";
import { totalWords } from "@/lib/rules/words";
import { AgentContext } from "@/lib/schema/context";
import type { Brief } from "@/lib/schema/brief";
import type { DraftBrief } from "@/lib/schema/draft-brief";
import { validateAll, validateDraft, validatePublished } from "@/lib/validate";

const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const weekday = () => read("fixtures/briefs/valid-weekday.json") as DraftBrief;
const weekdayContext = () => AgentContext.parse(read("fixtures/context/weekday.json"));
const weekdayEvidence = () => read("fixtures/evidence/weekday.json").urls as string[];

function publish(d: DraftBrief): Brief {
  return {
    ...d,
    published_at: "2026-10-28T06:10:00+08:00",
    computed: {
      pathways: Object.fromEntries(Object.entries(pathwayCounts([], d.date)).map(([k, v]) => [k, { incidents_30d: v.incidents_30d, baseline_monthly: v.baseline_monthly }])) as Brief["computed"]["pathways"],
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

describe("validatePublished", () => {
  it("accepts a brief with correct computed fields", () => {
    const r = validatePublished(publish(weekday()), { fileDate: "2026-10-28" });
    expect(r.errors).toEqual([]);
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
    write("incidents/2026.json", { schema_version: 1, year: 2026, incidents: [incident, { ...incident, date: "2026-10-01" }] });
    write("incidents/2025.json", { schema_version: 1, year: 2025, incidents: [{ ...incident, date: "2025-12-01" }] });
    write("briefs/2026-10-29.json", publish(weekday()));
    const codes = new Set(validateAll(dir).errors.map((e) => e.code));
    expect(codes).toEqual(new Set(["XREF_ID_DUP", "FILE_ORDER", "XREF_ID_YEAR", "DATE_MISMATCH", "XREF_UNRESOLVED"]));
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
