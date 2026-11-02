// One mutation of the weekday draft per validation code. Each must produce errors with exactly that code
// and no other, which the builder and tests check.

import type { DraftBrief } from "../../lib/schema/draft-brief";
import { p, url } from "./world";

export interface Mutation {
  code: string;
  mutate: (d: DraftBrief) => void;
}

const source = (d: DraftBrief, id: string) => d.sources.find((s) => s.id === id)!;
const dev = (d: DraftBrief, id: string) => d.developments.find((x) => x.id === id)!;
const country = (d: DraftBrief, code: string) => d.board.countries.find((c) => c.country === code)!;
const swap = <T>(xs: T[], i: number, j: number) => { [xs[i], xs[j]] = [xs[j]!, xs[i]!]; };

export const MUTATIONS: Mutation[] = [
  { code: "SCHEMA", mutate: (d) => { (d as unknown as Record<string, unknown>).editor_note = "remove before publishing"; } },
  { code: "DATE_MISMATCH", mutate: (d) => { d.date = "2026-10-27"; } },
  { code: "WINDOW_MISMATCH", mutate: (d) => { d.window.end = "2026-10-28T06:00:00+08:00"; } },
  { code: "WEEKLY_FLAG", mutate: (d) => { d.weekly = true; } },
  { code: "WORDS_OVER", mutate: (d) => { d.bottom_line = `${d.bottom_line} ${d.bottom_line}`; } },
  { code: "WORDS_UNDER", mutate: (d) => { d.judgement.text = d.judgement.text.split("\n\n")[0]!; } },
  { code: "PROB_TERM", mutate: (d) => { d.board.pathways[1]!.serious_odds = p(15, "unlikely", "moderate"); } },
  { code: "ORDER_PATHWAYS", mutate: (d) => swap(d.board.pathways, 0, 1) },
  { code: "ORDER_COUNTRIES", mutate: (d) => swap(d.board.countries, 0, 1) },
  { code: "ORDER_CATEGORIES", mutate: (d) => swap(d.categories, 0, 1) },
  { code: "RUNG_COMPUTED", mutate: (d) => { d.board.ladder.current_rung = 2; } },
  { code: "RUNG_PREVIOUS", mutate: (d) => { d.board.ladder.previous_rung = 2; } },
  { code: "NEXT_ODDS_NULL", mutate: (d) => { d.board.ladder.next_rung_odds = null; } },
  { code: "TREND", mutate: (d) => { d.board.pathways[0]!.trend = "flat"; } },
  {
    code: "PATHWAY_JUMP_SOURCES",
    mutate: (d) => { Object.assign(d.board.pathways[0]!, { serious_odds: p(50, "realistic_possibility", "moderate"), trend: "up", source_ids: [] }); },
  },
  { code: "COUNTRY_FLOOR", mutate: (d) => { Object.assign(country(d, "PL"), { score: 2, reason: "Lowered after a calm week.", source_ids: ["s1"] }); } },
  { code: "COUNTRY_CEILING", mutate: (d) => { Object.assign(country(d, "LT"), { score: 4, reason: "Balloon incursions continue.", source_ids: ["s1"] }); } },
  { code: "COUNTRY_REASON", mutate: (d) => { Object.assign(country(d, "EE"), { score: 4, reason: null, source_ids: [] }); } },
  { code: "COUNTRY_PREVIOUS", mutate: (d) => { country(d, "RO").previous_score = 2; } },
  { code: "COHESION_FLAG", mutate: (d) => { country(d, "PL").cohesion_flag = true; } },
  {
    code: "DEV_COUNT",
    mutate: (d) => { for (let n = 5; n <= 9; n++) d.developments.push({ ...dev(d, "d4"), id: `d${n}` }); },
  },
  { code: "PIVOTAL_MAX", mutate: (d) => { dev(d, "d1").importance = "pivotal"; dev(d, "d2").importance = "pivotal"; } },
  { code: "DEV_SOURCES", mutate: (d) => { dev(d, "d1").source_ids = ["s1"]; } },
  { code: "DEV_LADDER", mutate: (d) => { dev(d, "d2").verification = 4; } },
  { code: "CATEGORY_TEXT", mutate: (d) => { d.categories[5]!.text = "Nothing new."; } },
  { code: "SOURCE_REF", mutate: (d) => { dev(d, "d4").source_ids.push("s99"); } },
  { code: "SOURCE_DUP", mutate: (d) => { source(d, "s16").url = source(d, "s7").url; } },
  { code: "SOURCE_URL", mutate: (d) => { source(d, "s7").url = "https://news.google.com/rss/articles/CBMiSAMPLE"; } },
  { code: "SOURCE_MIN", mutate: (d) => { for (const id of ["s11", "s12", "s13", "s14", "s15"]) source(d, id).category = "intl_press"; } },
  { code: "SOURCE_SIDES", mutate: (d) => { for (const id of ["s3", "s17"]) source(d, id).category = "ua_independent"; } },
  { code: "SOURCE_UNSEEN", mutate: (d) => { source(d, "s13").url = url("kyivindependent/never-seen-by-the-agent"); } },
  { code: "BOTTOM_LINE_SOURCES", mutate: (d) => { d.bottom_line_source_ids = ["s1"]; } },
  { code: "ID_FORMAT", mutate: (d) => { d.forecasts_new[0]!.id = "F-2025-014"; } },
  {
    code: "ID_SEQUENCE",
    mutate: (d) => { d.incidents_new[0]!.id = "INC-2026-0132"; dev(d, "d1").incident_ids = ["INC-2026-0132"]; },
  },
  {
    code: "ID_DUPLICATE",
    mutate: (d) => {
      dev(d, "d4").id = "d3";
      for (const c of d.categories) c.development_ids = c.development_ids.map((id) => (id === "d4" ? "d3" : id));
    },
  },
  { code: "RECORD_FIELDS", mutate: (d) => { d.incidents_new[0]!.seed = true; } },
  { code: "INCIDENT_TYPE", mutate: (d) => { d.incidents_new[0]!.type = "drone_swarm"; } },
  { code: "INCIDENT_RUNG", mutate: (d) => { d.incidents_new[0]!.rung = 2; } },
  { code: "INCIDENT_LOCATION", mutate: (d) => { d.incidents_new[0]!.affected = []; } },
  { code: "INCIDENT_SOURCES", mutate: (d) => { d.incidents_new[0]!.sources = d.incidents_new[0]!.sources.slice(0, 1); } },
  { code: "INCIDENT_PRECISION", mutate: (d) => { d.incidents_new[0]!.date_precision = "month"; } },
  { code: "UPDATE_TARGET", mutate: (d) => { d.strike_updates[0]!.id = "STR-2026-0300"; } },
  { code: "UPDATE_EVIDENCE", mutate: (d) => { d.strike_updates[0]!.add_sources = []; } },
  {
    code: "STRIKE_EVIDENCE",
    mutate: (d) => { d.strikes_new[0]!.sources = d.strikes_new[0]!.sources.filter((s) => s.category !== "osint_data"); },
  },
  { code: "INDICATOR_CHANGE", mutate: (d) => { d.indicator_changes[0]!.to = "watch"; } },
  {
    code: "INDICATOR_NEW",
    mutate: (d) => {
      d.indicators_new.push({ id: "ind-airspace-tempo", tier: "incident", name: "Airspace tempo (duplicate)", description: "A duplicate of an existing indicator.", countries: [], status: "watch", evidence: "Sample evidence.", source_ids: ["s1"] });
    },
  },
  { code: "FORECAST_NEW", mutate: (d) => { d.forecasts_new[0]!.question = d.forecasts_new[0]!.question.replace(/\?$/, "."); } },
  { code: "FORECAST_REF", mutate: (d) => { d.forecast_updates[0]!.id = "F-2026-099"; } },
  { code: "ASSUMPTION_REF", mutate: (d) => { d.assumption_updates[0]!.id = "A9"; } },
  { code: "NEXT72_DATE", mutate: (d) => { d.next_72h[0]!.date = "2026-11-05"; } },
  { code: "METRIC_UNIT", mutate: (d) => { d.metrics[0]!.unit = "drones"; } },
  { code: "METRIC_DUP", mutate: (d) => { d.metrics.push({ ...d.metrics[0]! }); } },
  { code: "METRIC_SOURCE", mutate: (d) => { d.metrics.find((m) => m.value === null)!.value = 41; } },
  { code: "TAIWAN_EMPTY", mutate: (d) => { d.taiwan = ""; } },
];
