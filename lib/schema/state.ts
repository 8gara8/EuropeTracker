import { z } from "zod";
import {
  AssumptionId, CountryCode, Impact, IndicatorId, IndicatorStatus, IndicatorTier, IsoDate, Pathway,
  ProbabilityEstimate, Rung, Score, Tier1Code, Trend,
} from "./common";

export const Indicator = z.strictObject({
  id: IndicatorId,
  tier: IndicatorTier,
  name: z.string().min(1).max(80),
  description: z.string().min(1),
  countries: z.array(CountryCode).describe("Countries it names; [] = Europe-wide"),
  status: IndicatorStatus,
  since: IsoDate.describe("Date the status last changed"),
  last_evidence: z.string().nullable(),
  last_evidence_date: IsoDate.nullable(),
});

export const Assumption = z.strictObject({
  id: AssumptionId,
  text: z.string().min(1),
  since: IsoDate,
  status: z.enum(["active", "retired"]),
  retired_on: IsoDate.nullable(),
  retired_reason: z.string().nullable(),
});

export const StatePathway = z.strictObject({
  pathway: Pathway,
  serious_odds: ProbabilityEstimate,
  impact: Impact,
  trend: Trend,
});

export const StateCountry = z.strictObject({
  country: Tier1Code,
  score: Score,
  since: IsoDate,
});

const OutlookQuestion = z.strictObject({ question: z.string().min(1), estimate: ProbabilityEstimate });

export const State = z.strictObject({
  schema_version: z.literal(1),
  as_of: z.union([IsoDate, z.literal("seed")]).describe('Date of the last applied brief, or "seed"'),
  ladder: z.strictObject({ current_rung: Rung, next_rung_odds: ProbabilityEstimate.nullable() }),
  pathways: z.array(StatePathway),
  countries: z.array(StateCountry),
  indicators: z.array(Indicator),
  assumptions: z.array(Assumption),
  weekly: z.strictObject({ as_of: IsoDate, medium_term: OutlookQuestion, long_term: OutlookQuestion }).nullable(),
});

export type Indicator = z.infer<typeof Indicator>;
export type Assumption = z.infer<typeof Assumption>;
export type State = z.infer<typeof State>;
