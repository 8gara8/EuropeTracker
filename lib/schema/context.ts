import { z } from "zod";
import { TIER1 } from "../vocab";
import { ForecastId, IncidentId, IsoDate, IsoTimestamp, Pathway, Rung, Score, StrikeId, Window } from "./common";
import { Forecast } from "./forecast";
import { IncidentBrief } from "./incident";
import { Assumption, State } from "./state";
import { Strike } from "./strike";

// `drafts/context.json`, built by scripts/build-context.ts (SPEC §4.14).

export const PathwayCounts = z.strictObject({
  incidents_30d: z.int().min(0),
  baseline_monthly: z.number().min(0),
  serious_12m: z.int().min(0),
  monthly_avg_since_2022: z.number().min(0),
});

const Year = z.string().regex(/^\d{4}$/);

export const AgentContext = z.strictObject({
  date: IsoDate,
  window: Window,
  weekly: z.boolean(),
  deadline: IsoTimestamp,
  state: State,
  computed: z.strictObject({
    current_rung: Rung,
    pathways: z.record(Pathway, PathwayCounts),
    countries: z.record(z.enum(TIER1), z.strictObject({ max_rung_30d: z.int().min(0).max(6), floor: Score })),
    incidents_last_30d: z.array(IncidentBrief),
  }),
  next_ids: z.strictObject({
    incident: z.record(Year, IncidentId),
    strike: z.record(Year, StrikeId),
    forecast: ForecastId,
  }),
  open_forecasts: z.array(Forecast),
  recent_briefs: z.array(z.strictObject({
    date: IsoDate,
    title: z.string(),
    bottom_line: z.string(),
    judgement: z.string(),
  })),
  recent_strikes: z.array(Strike),
  active_assumptions: z.array(Assumption),
  pack: z.strictObject({
    md: z.string(),
    json: z.string(),
    degraded: z.boolean(),
    failed_feeds: z.array(z.string()),
  }),
});

export type PathwayCounts = z.infer<typeof PathwayCounts>;
export type AgentContext = z.infer<typeof AgentContext>;
