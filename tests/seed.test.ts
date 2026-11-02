import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "@/lib/content";
import { State } from "@/lib/schema/state";
import { PATHWAYS } from "@/lib/vocab";
import { buildForecasts, buildIncidents, buildState, buildStrikes } from "@/scripts/seed-build";

// Phase 4 milestone checks (SPEC §9). The second test only applies before go-live: once daily briefs
// exist, content/ moves on from the seed files.

const content = loadContent("content", { fresh: true });
const live = content.briefs.length > 0;

describe("seed data", () => {
  it("has at least one incident in every pathway", () => {
    for (const p of PATHWAYS) expect(content.incidents.some((i) => i.pathway === p), p).toBe(true);
  });

  it.skipIf(live)("matches what research/seed builds", () => {
    const added = content.incidents[0]!.added;
    const incidents = buildIncidents("research/seed", added);
    expect(incidents).toEqual(content.incidents);
    expect(buildStrikes("research/seed", added)).toEqual(content.strikes);
    expect(buildForecasts("research/seed", added)).toEqual(content.forecasts);
    const current = State.parse(JSON.parse(fs.readFileSync("content/state.json", "utf8")));
    expect(buildState("research/seed", current, incidents)).toEqual(content.state);
  });
});
