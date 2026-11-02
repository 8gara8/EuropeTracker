import { z } from "zod";
import { ForecastId, IsoTimestamp, Pathway } from "./common";
import { DraftBrief, ForecastNew } from "./draft-brief";
import { Incident } from "./incident";
import { Strike } from "./strike";

// A published brief, `content/briefs/YYYY-MM-DD.json` (SPEC §4.5): the draft plus fields only code sets.
// New records carry their strict id formats here, since publish.ts has already checked them.

export const BriefComputed = z.strictObject({
  pathways: z.record(Pathway, z.strictObject({
    incidents_30d: z.int().min(0),
    baseline_monthly: z.number().min(0),
  })),
  word_count: z.int().min(0),
  source_count: z.int().min(0),
  source_category_count: z.int().min(0),
});

export const Brief = DraftBrief.extend({
  incidents_new: z.array(Incident),
  strikes_new: z.array(Strike),
  forecasts_new: z.array(ForecastNew.extend({ id: ForecastId })),
  published_at: IsoTimestamp,
  computed: BriefComputed,
});

export type BriefComputed = z.infer<typeof BriefComputed>;
export type Brief = z.infer<typeof Brief>;
