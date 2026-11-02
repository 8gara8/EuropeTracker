import { z } from "zod";
import { METRIC_IDS } from "../vocab";
import {
  AttributionLevel, Category, CountryCode, DevelopmentId, EvidenceSource, Horizon, Impact, Importance,
  IncidentRung, IndicatorStatus, IndicatorTier, IsoDate, IsoTimestamp, Pathway, ProbabilityEstimate, Rung,
  Score, Source, Trend, VerificationLevel, Window, words,
} from "./common";
import { Incident } from "./incident";
import { Strike } from "./strike";

// The agent's output, `drafts/YYYY-MM-DD.json` (SPEC §4.4). Checks that have their own validation code
// (word budgets, orders, counts, id formats of new records) live in lib/rules, not here, so the agent
// gets the targeted message.

const refs = (help: string) => z.array(z.string()).describe(help);

export const PathwayScore = z.strictObject({
  pathway: Pathway,
  serious_odds: ProbabilityEstimate.describe("30-day probability of at least one serious incident in this pathway"),
  impact: Impact.describe("Consequence if it happens: 1 local disruption, 2 national under a day, 3 major disruption or casualties, 4 multiple deaths or alliance crisis, 5 war-level"),
  trend: Trend.describe("Against state: up if the probability rose 5 points or more, down if it fell 5 or more, else flat"),
  rationale: words("≤ 40 words: the base rate plus the reason for any change"),
  source_ids: refs("Source ids; at least 1 when the probability moved 15 points or more"),
});

export const CountryScore = z.strictObject({
  country: CountryCode,
  score: Score,
  previous_score: Score.nullable().describe("The state's score for tier-1 countries; null for tier 2"),
  reason: words("≤ 40 words; required when the score changed or is above the floor").nullable(),
  source_ids: refs("At least 1 when the score changed"),
  indicator_ids: refs("Active strategic indicators naming this country"),
  cohesion_flag: z.boolean().describe("Only Hungary or Slovakia may be flagged"),
});

export const Development = z.strictObject({
  id: DevelopmentId,
  headline: z.string().min(1).max(140),
  summary: words("20–80 words"),
  category: Category,
  importance: Importance.describe("At most one pivotal per brief"),
  incident_ids: refs("Incidents (new or existing) this development is about"),
  strike_ids: refs("Strikes (new or existing) this development is about"),
  verification: VerificationLevel.nullable().describe("Required when strike_ids is non-empty: the highest verification among them"),
  attribution: AttributionLevel.nullable().describe("Required when incident_ids is non-empty: the highest attribution among them"),
  russian_framing: words("≤ 40 words, reported as a claim").nullable(),
  source_ids: refs("At least 1; pivotal and major need at least 2 from at least 2 categories"),
});

export const CategoryNote = z.strictObject({
  category: Category,
  status: z.enum(["material", "no_change"]),
  text: words('material: ≤ 60 words; no_change: exactly "No material change."'),
  development_ids: refs("Development ids this note draws on"),
  source_ids: refs("At least 1 when material"),
});

export const IncidentUpdate = z.strictObject({
  id: z.string().describe("An existing incident, not one in incidents_new"),
  changes: z.strictObject({
    attribution: AttributionLevel.nullable(),
    attribution_note: words("≤ 40 words").nullable(),
    rung: IncidentRung.nullable(),
    serious: z.boolean().nullable(),
    casualties: z.strictObject({ killed: z.int().min(0), injured: z.int().min(0) }).nullable(),
    disruption_hours: z.number().min(0).nullable(),
    summary: words("≤ 60 words").nullable(),
  }).describe("null = unchanged; at least one non-null"),
  add_sources: z.array(EvidenceSource).describe("At least 1 when attribution or rung changes"),
  reason: words("≤ 40 words"),
});

export const StrikeUpdate = z.strictObject({
  id: z.string().describe("An existing strike, not one in strikes_new"),
  changes: z.strictObject({
    verification: VerificationLevel.nullable(),
    damage: words("≤ 30 words").nullable(),
    effect: words("≤ 30 words").nullable(),
    summary: words("≤ 50 words").nullable(),
    weapon_detail: z.string().max(40).nullable(),
    western_weapon: z.boolean().nullable(),
  }).describe("null = unchanged; at least one non-null"),
  add_sources: z.array(EvidenceSource).describe("At least 1 when verification changes; must carry the new level's evidence"),
  reason: words("≤ 40 words"),
});

export const IndicatorChange = z.strictObject({
  id: z.string(),
  to: IndicatorStatus,
  evidence: words("≤ 50 words"),
  source_ids: refs("At least 1"),
});

export const IndicatorNew = z.strictObject({
  id: z.string().describe("ind-… (lower-case letters, digits and hyphens), not already in state"),
  tier: IndicatorTier,
  name: z.string().min(1).max(80),
  description: words("≤ 50 words"),
  countries: z.array(CountryCode),
  status: IndicatorStatus,
  evidence: words("≤ 50 words"),
  source_ids: refs("At least 1"),
});

export const CompetingExplanation = z.strictObject({
  subject: words("≤ 20 words, e.g. \"INC-2026-0131: drones over Rzeszów\""),
  hypotheses: z.array(z.strictObject({
    label: words("≤ 12 words"),
    assessment: words("≤ 40 words"),
    estimate: ProbabilityEstimate,
  })).min(2).max(4),
});

export const ForecastNew = z.strictObject({
  id: z.string().describe("context.next_ids.forecast, then +1 for each further one"),
  question: z.string().min(1).max(200).describe("Binary; ends with ?"),
  resolution_criteria: z.string().min(1).max(300).describe("Observable"),
  resolves_by: IsoDate.describe("After the brief date, at most 400 days later"),
  horizon: Horizon,
  pathway: Pathway.nullable(),
  probability: z.int().describe("Integer 1–99"),
  base_rate: z.int().min(0).max(100).describe("What a forecaster using only history would say"),
  base_rate_note: words("≤ 40 words"),
});

export const ForecastUpdate = z.strictObject({
  id: z.string(),
  probability: z.int().min(1).max(99),
  note: words("≤ 30 words"),
});

export const ForecastResolution = z.strictObject({
  id: z.string(),
  outcome: z.enum(["yes", "no", "annulled"]),
  note: words("≤ 40 words"),
  source_id: z.string().describe("A source id in this brief"),
});

export const AssumptionUpdate = z.strictObject({
  op: z.enum(["add", "revise", "retire", "reaffirm"]),
  id: z.string().nullable().describe("null only for add (publish assigns the next A#)"),
  text: words("≤ 40 words; required for add and revise").nullable(),
  reason: words("≤ 40 words"),
});

export const NextEvent = z.strictObject({
  date: IsoDate.describe("Within the 3 days after the brief date"),
  event: words("≤ 25 words"),
  why: words("≤ 25 words"),
});

const Outlook = z.strictObject({
  question: z.string().min(1),
  estimate: ProbabilityEstimate,
  text: words("≤ 200 words"),
});

export const WeeklyOutlook = z.strictObject({
  medium_term: Outlook.describe("6–12 months"),
  long_term: Outlook.describe("2–5 years"),
  assumptions_check: z.array(z.strictObject({
    id: z.string(),
    status: z.enum(["holds", "weakening", "broken"]),
    note: words("≤ 30 words"),
  })).describe("Every active assumption, exactly once"),
  calibration_note: words("≤ 80 words"),
});

export const Metric = z.strictObject({
  id: z.enum(METRIC_IDS),
  value: z.number().nullable().describe("null = not available today"),
  unit: z.string().describe("Must equal METRICS[id].unit"),
  period: z.string().min(1).max(40).describe('E.g. "night of 1–2 Nov", "2 Nov"'),
  source_ids: refs("At least 1 when value is not null"),
  note: words("≤ 20 words").nullable(),
});

export const DraftIncident = Incident.extend({
  id: z.string().describe("INC-YYYY-NNNN continuing context.next_ids.incident[YYYY], where YYYY is the year of date"),
});

export const DraftStrike = Strike.extend({
  id: z.string().describe("STR-YYYY-NNNN continuing context.next_ids.strike[YYYY], where YYYY is the year of date"),
});

export const DraftBrief = z.strictObject({
  schema_version: z.literal(1),
  date: IsoDate.describe("Taipei date of the run; equals the file name"),
  window: Window.describe("Exactly the window strings from the prompt"),
  generated_at: IsoTimestamp,
  quiet_day: z.boolean().describe("true when there are fewer than 3 material developments"),
  weekly: z.boolean().describe("true when date is a Monday; then weekly_outlook is required"),
  title: z.string().min(1).max(140),
  bottom_line: words("40–120 words"),
  bottom_line_source_ids: refs("At least 2 source ids spanning at least 2 source categories"),

  board: z.strictObject({
    ladder: z.strictObject({
      current_rung: Rung.describe("Must equal the computed rung after adding today's incidents"),
      previous_rung: Rung.describe("Must equal state.ladder.current_rung"),
      next_rung_odds: ProbabilityEstimate.nullable().describe("30-day probability of any incident above the current rung; null only at rung 6"),
      rationale: words("≤ 60 words"),
    }),
    pathways: z.array(PathwayScore).describe("Exactly 7, in PATHWAYS order"),
    countries: z.array(CountryScore).describe("The 7 tier-1 countries in order (PL, LT, LV, EE, FI, RO, MD), then any tier-2 countries touched today"),
  }),

  developments: z.array(Development).describe("3–8 (quiet day 0–3)"),
  categories: z.array(CategoryNote).describe("Exactly 12, in CATEGORIES order"),

  incidents_new: z.array(DraftIncident),
  incident_updates: z.array(IncidentUpdate),
  strikes_new: z.array(DraftStrike),
  strike_updates: z.array(StrikeUpdate),

  indicator_changes: z.array(IndicatorChange).describe("Status changes only"),
  indicators_new: z.array(IndicatorNew),

  judgement: z.strictObject({
    text: words("150–400 words (quiet day 60–250)"),
    change_my_mind: words("≤ 50 words"),
    competing_explanations: z.array(CompetingExplanation).max(2),
  }),

  forecasts_new: z.array(ForecastNew).describe("0–3"),
  forecast_updates: z.array(ForecastUpdate).max(10),
  forecast_resolutions: z.array(ForecastResolution),
  assumption_updates: z.array(AssumptionUpdate),

  taiwan: words('"Impact on Taiwan", 1–150 words: how today\'s developments might affect Taiwan (STYLE.md §14), or exactly the no-news line'),
  next_72h: z.array(NextEvent).max(8),
  weekly_outlook: WeeklyOutlook.nullable().describe("Non-null if and only if weekly is true"),
  metrics: z.array(Metric).describe("Each metric id at most once"),
  sources: z.array(Source).describe("At least 10 from at least 7 categories (quiet day: 5 from 4)"),
});

export type PathwayScore = z.infer<typeof PathwayScore>;
export type CountryScore = z.infer<typeof CountryScore>;
export type Development = z.infer<typeof Development>;
export type CategoryNote = z.infer<typeof CategoryNote>;
export type IncidentUpdate = z.infer<typeof IncidentUpdate>;
export type StrikeUpdate = z.infer<typeof StrikeUpdate>;
export type IndicatorChange = z.infer<typeof IndicatorChange>;
export type IndicatorNew = z.infer<typeof IndicatorNew>;
export type CompetingExplanation = z.infer<typeof CompetingExplanation>;
export type ForecastNew = z.infer<typeof ForecastNew>;
export type ForecastUpdate = z.infer<typeof ForecastUpdate>;
export type ForecastResolution = z.infer<typeof ForecastResolution>;
export type AssumptionUpdate = z.infer<typeof AssumptionUpdate>;
export type NextEvent = z.infer<typeof NextEvent>;
export type WeeklyOutlook = z.infer<typeof WeeklyOutlook>;
export type Metric = z.infer<typeof Metric>;
export type DraftIncident = z.infer<typeof DraftIncident>;
export type DraftStrike = z.infer<typeof DraftStrike>;
export type DraftBrief = z.infer<typeof DraftBrief>;
