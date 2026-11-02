import { z } from "zod";
import { ForecastId, IsoTimestamp, Pathway } from "./common";
import { DraftBrief, ForecastNew, WeeklyOutlook } from "./draft-brief";
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

// Each check keeps the assumption's text as the brief assessed it, so revising the assumption later
// doesn't change what an archived outlook says.
export const PublishedWeeklyOutlook = WeeklyOutlook.extend({
  assumptions_check: z.array(WeeklyOutlook.shape.assumptions_check.element.extend({
    text: z.string().min(1).describe("The assumption's text when the brief was written"),
  })),
});

export const Brief = DraftBrief.extend({
  incidents_new: z.array(Incident),
  strikes_new: z.array(Strike),
  forecasts_new: z.array(ForecastNew.extend({ id: ForecastId })),
  weekly_outlook: PublishedWeeklyOutlook.nullable(),
  published_at: IsoTimestamp,
  computed: BriefComputed,
});

export type PublishedWeeklyOutlook = z.infer<typeof PublishedWeeklyOutlook>;
export type BriefComputed = z.infer<typeof BriefComputed>;
export type Brief = z.infer<typeof Brief>;
