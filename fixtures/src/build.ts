// Writes the validator fixtures (SPEC §9 Phase 1): three valid SAMPLE drafts with their contexts and
// evidence, and one invalid draft per validation code. Run with `npm run fixtures:gen` after changing a
// schema, a rule or anything in fixtures/src, then commit the output. Fails if a fixture doesn't
// validate the way it should.

import fs from "node:fs";
import { citedUrls } from "../../lib/rules/sources";
import { AgentContext } from "../../lib/schema/context";
import type { DraftBrief } from "../../lib/schema/draft-brief";
import type { Forecast } from "../../lib/schema/forecast";
import type { IncidentBrief } from "../../lib/schema/incident";
import { validateDraft } from "../../lib/validate";
import { monday, quiet, weekday } from "./drafts";
import { MUTATIONS } from "./invalid";
import { FORECASTS, INCIDENTS, STRIKES, contextFor, packNoise, stateAsOf } from "./world";

const write = (file: string, value: unknown) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const clone = <T>(v: T): T => structuredClone(v);

function openedFrom(d: DraftBrief, f: DraftBrief["forecasts_new"][number]): Forecast {
  return { ...f, opened: d.date, updates: [], status: "open", resolved_on: null, resolution_note: null, resolution_source: null, brier: null, brier_base: null };
}

// Contexts: the state of the world on each fixture morning.
const f013 = openedFrom(monday, monday.forecasts_new[0]!);
const f014 = openedFrom(weekday, weekday.forecasts_new[0]!);

const contexts = {
  monday: contextFor("2026-10-26", {
    state: stateAsOf("2026-10-25"),
    incidents: INCIDENTS,
    strikes: STRIKES.filter((s) => s.id !== "STR-2026-0456"),
    forecasts: FORECASTS,
    nextIncident: "INC-2026-0131", nextStrike: "STR-2026-0456", nextForecast: "F-2026-013",
  }),
  weekday: contextFor("2026-10-28", {
    state: stateAsOf("2026-10-27"),
    incidents: INCIDENTS,
    strikes: STRIKES,
    forecasts: [...FORECASTS.filter((f) => f.id !== "F-2026-005"), f013],
    nextIncident: "INC-2026-0131", nextStrike: "STR-2026-0457", nextForecast: "F-2026-014",
  }),
  quiet: contextFor("2026-10-29", {
    state: stateAsOf("2026-10-28", { airspace: 35, airspaceTrend: "up", airspaceActive: true }),
    incidents: [
      ...INCIDENTS.map((i): IncidentBrief => (i.id === "INC-2026-0124" ? { ...i, attribution: 3 } : i)),
      (({ id, date, affected, pathway, type, rung, attribution, summary }) => ({ id, date, affected, pathway, type, rung, attribution, summary }))(weekday.incidents_new[0]!),
    ],
    strikes: [
      ...STRIKES.map((s) => (s.id === "STR-2026-0452" ? { ...s, verification: 4 as const, damage: weekday.strike_updates[0]!.changes.damage, updated: "2026-10-28" } : s)),
      weekday.strikes_new[0]!,
    ],
    forecasts: [
      ...FORECASTS.filter((f) => f.id !== "F-2026-005").map((f) => (f.id === "F-2026-011" ? { ...f, updates: [{ date: "2026-10-28", probability: 12, note: weekday.forecast_updates[0]!.note }] } : f)),
      f013,
      f014,
    ],
    nextIncident: "INC-2026-0132", nextStrike: "STR-2026-0458", nextForecast: "F-2026-015",
  }),
};

const drafts = { weekday, monday, quiet };

fs.mkdirSync("fixtures/briefs", { recursive: true });
fs.mkdirSync("fixtures/context", { recursive: true });
fs.mkdirSync("fixtures/evidence", { recursive: true });

const evidence: Record<string, string[]> = {};
for (const name of ["weekday", "monday", "quiet"] as const) {
  const ctx = AgentContext.parse(contexts[name]);
  const draft = drafts[name];
  evidence[name] = [...new Set([...citedUrls(draft).map((c) => c.url), ...packNoise(draft.date)])];
  write(`fixtures/context/${name}.json`, ctx);
  write(`fixtures/evidence/${name}.json`, { urls: evidence[name] });
  write(`fixtures/briefs/valid-${name}.json`, draft);
  const r = validateDraft(draft, { context: ctx, evidence: evidence[name] });
  if (!r.ok) {
    console.error(`valid-${name}.json does not validate:`);
    for (const e of r.errors) console.error(`  ${e.code} ${e.path}: ${e.message}`);
    process.exit(1);
  }
  for (const w of r.warnings) console.log(`  valid-${name}: warning ${w.code} ${w.path}: ${w.message}`);
}

for (const f of fs.readdirSync("fixtures/briefs")) {
  if (f.startsWith("invalid--")) fs.rmSync(`fixtures/briefs/${f}`);
}
let failed = false;
for (const m of MUTATIONS) {
  const d = clone(weekday);
  m.mutate(d);
  write(`fixtures/briefs/invalid--${m.code}.json`, d);
  const r = validateDraft(d, { context: contexts.weekday, evidence: evidence.weekday });
  const codes = [...new Set(r.errors.map((e) => e.code))];
  if (codes.length !== 1 || codes[0] !== m.code) {
    failed = true;
    console.error(`invalid--${m.code}.json gives [${codes.join(", ")}]:`);
    for (const e of r.errors) console.error(`  ${e.code} ${e.path}: ${e.message}`);
  }
}
if (failed) process.exit(1);
console.log(`Wrote 3 valid and ${MUTATIONS.length} invalid fixtures.`);
