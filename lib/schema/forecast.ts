import { z } from "zod";
import { EvidenceSource, ForecastId, Horizon, IsoDate, Pathway } from "./common";

export const Forecast = z.strictObject({
  id: ForecastId,
  question: z.string().min(1).max(200),
  resolution_criteria: z.string().min(1).max(300),
  resolves_by: IsoDate,
  horizon: Horizon,
  pathway: Pathway.nullable(),
  probability: z.int().min(1).max(99).describe("At open"),
  base_rate: z.int().min(0).max(100),
  base_rate_note: z.string(),
  opened: IsoDate,
  updates: z.array(z.strictObject({ date: IsoDate, probability: z.int().min(1).max(99), note: z.string() })),
  status: z.enum(["open", "resolved_yes", "resolved_no", "annulled"]),
  resolved_on: IsoDate.nullable(),
  resolution_note: z.string().nullable(),
  resolution_source: EvidenceSource.nullable(),
  brier: z.number().min(0).max(1).nullable(),
  brier_base: z.number().min(0).max(1).nullable(),
});

export const ForecastsFile = z.strictObject({
  schema_version: z.literal(1),
  forecasts: z.array(Forecast),
});

export type Forecast = z.infer<typeof Forecast>;
export type ForecastsFile = z.infer<typeof ForecastsFile>;
