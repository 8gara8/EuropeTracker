import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { AgentContext } from "@/lib/schema/context";
import { validateDraft } from "@/lib/validate";

const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const context = (name: string) => AgentContext.parse(read(`fixtures/context/${name}.json`));
const evidence = (name: string) => read(`fixtures/evidence/${name}.json`).urls as string[];

describe("valid fixtures", () => {
  for (const name of ["weekday", "monday", "quiet"]) {
    it(`valid-${name}.json passes with no errors`, () => {
      const r = validateDraft(read(`fixtures/briefs/valid-${name}.json`), { context: context(name), evidence: evidence(name) });
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
    });
  }

  it("valid-monday.json is a weekly brief and valid-quiet.json a quiet one", () => {
    expect(read("fixtures/briefs/valid-monday.json").weekly_outlook).not.toBeNull();
    expect(read("fixtures/briefs/valid-quiet.json").quiet_day).toBe(true);
  });

  it("warns instead of checking evidence when none is given", () => {
    const r = validateDraft(read("fixtures/briefs/valid-weekday.json"), { context: context("weekday") });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain("SOURCE_UNSEEN");
  });
});

describe("invalid fixtures", () => {
  const files = fs.readdirSync("fixtures/briefs").filter((f) => f.startsWith("invalid--"));
  const required = ["WORDS_OVER", "PROB_TERM", "ORDER_PATHWAYS", "RUNG_COMPUTED", "TREND", "COUNTRY_FLOOR",
    "COUNTRY_CEILING", "PIVOTAL_MAX", "DEV_SOURCES", "SOURCE_MIN", "SOURCE_SIDES", "SOURCE_UNSEEN",
    "INCIDENT_SOURCES", "STRIKE_EVIDENCE", "ID_SEQUENCE", "WEEKLY_FLAG", "SCHEMA"];

  it("cover every code SPEC §9 asks for, and at least 15 files", () => {
    const codes = files.map((f) => f.replace(/^invalid--|\.json$/g, ""));
    expect(files.length).toBeGreaterThanOrEqual(15);
    for (const code of required) expect(codes).toContain(code);
  });

  for (const file of files) {
    const code = file.replace(/^invalid--|\.json$/g, "");
    it(`${file} fails with exactly ${code}`, () => {
      const r = validateDraft(read(`fixtures/briefs/${file}`), { context: context("weekday"), evidence: evidence("weekday") });
      expect(r.ok).toBe(false);
      expect([...new Set(r.errors.map((e) => e.code))]).toEqual([code]);
      for (const e of r.errors) expect(e.message.length).toBeGreaterThan(10);
    });
  }
});
