import { z } from "zod";
import { isValidDate } from "../dates";
import {
  CATEGORIES, CONFIDENCE, COUNTRIES, HORIZONS, IMPORTANCE, INDICATOR_STATUS, INDICATOR_TIERS, PATHWAYS,
  PROBABILITY_TERM_IDS, SOURCE_CATEGORY_IDS, TIER1, TRENDS,
} from "../vocab";

// Shared building blocks (SPEC §4.3). Every object is strict: unknown keys are errors, and absent
// values are null or [], never missing.

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export const IsoDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Expected a date as YYYY-MM-DD", abort: true })
  .refine(isValidDate, { error: "Not a real calendar date" });

export const IsoTimestamp = z.string()
  .regex(TIMESTAMP_RE, { error: "Expected an ISO 8601 timestamp with an offset, e.g. 2026-11-03T05:30:00+08:00", abort: true })
  .refine((s) => !Number.isNaN(Date.parse(s)), { error: "Not a real timestamp" });

/** A publication time: a full timestamp when known, a bare date when only the day is known. */
export const PublishedAt = z.union([IsoTimestamp, IsoDate]).nullable()
  .describe("ISO timestamp with offset if known, a YYYY-MM-DD date if only the day is known, else null");

export const Window = z.strictObject({ start: IsoTimestamp, end: IsoTimestamp });

const idPattern = (re: RegExp, example: string) =>
  z.string().regex(re, { error: `Expected an id like ${example} (pattern ${re.source})` });

export const ID_PATTERNS = {
  source: /^s[1-9][0-9]*$/,
  incident: /^INC-\d{4}-\d{4}$/,
  strike: /^STR-\d{4}-\d{4}$/,
  forecast: /^F-\d{4}-\d{3}$/,
  correction: /^C-\d{4}$/,
  assumption: /^A[1-9][0-9]*$/,
  indicator: /^ind-[a-z0-9-]+$/,
  development: /^d[1-9][0-9]*$/,
  packItem: /^p\d{4,}$/,
} as const;

export const SourceId = idPattern(ID_PATTERNS.source, "s12");
export const IncidentId = idPattern(ID_PATTERNS.incident, "INC-2026-0131");
export const StrikeId = idPattern(ID_PATTERNS.strike, "STR-2026-0042");
export const ForecastId = idPattern(ID_PATTERNS.forecast, "F-2026-007");
export const CorrectionId = idPattern(ID_PATTERNS.correction, "C-0001");
export const AssumptionId = idPattern(ID_PATTERNS.assumption, "A3");
export const IndicatorId = idPattern(ID_PATTERNS.indicator, "ind-airspace-tempo");
export const DevelopmentId = idPattern(ID_PATTERNS.development, "d2");

export const Pathway = z.enum(PATHWAYS);
export const Category = z.enum(CATEGORIES);
export const SourceCategory = z.enum(SOURCE_CATEGORY_IDS);
export const CountryCode = z.enum(COUNTRIES);
export const Tier1Code = z.enum(TIER1);
export const Confidence = z.enum(CONFIDENCE);
export const Trend = z.enum(TRENDS);
export const Importance = z.enum(IMPORTANCE);
export const Horizon = z.enum(HORIZONS);
export const IndicatorTier = z.enum(INDICATOR_TIERS);
export const IndicatorStatus = z.enum(INDICATOR_STATUS);

export const Rung = z.literal([0, 1, 2, 3, 4, 5, 6]);
export const IncidentRung = z.literal([1, 2, 3, 4, 5, 6]);
export const Impact = z.literal([1, 2, 3, 4, 5]);
export const Score = z.literal([1, 2, 3, 4, 5]);
export const AttributionLevel = z.literal([1, 2, 3, 4]);
export const VerificationLevel = z.literal([1, 2, 3, 4, 5]);
export const Language = z.string().regex(/^[a-z]{2}$/, { error: "Expected an ISO 639-1 code such as en, uk, ru or pl" });

/** A string field whose budget is in words; the rules enforce it (WORDS_OVER, WORDS_UNDER). */
export const words = (budget: string) => z.string().describe(budget);

export const ProbabilityEstimate = z.strictObject({
  probability: z.int().min(0).max(100).describe("Integer 0–100 that lies inside the band of `term` (STYLE.md §7)"),
  term: z.enum(PROBABILITY_TERM_IDS),
  confidence: Confidence,
});

export const Source = z.strictObject({
  id: SourceId,
  title: z.string().min(1).max(200),
  outlet: z.string().min(1).max(80),
  category: SourceCategory,
  url: z.string().min(1).describe("https URL you opened, saw in search results, or found in the pack. Never news.google.com"),
  language: Language,
  published_at: PublishedAt,
  accessed_at: IsoTimestamp,
});

export const EvidenceSource = z.strictObject({
  title: z.string().min(1).max(200),
  outlet: z.string().min(1).max(80),
  category: SourceCategory,
  url: z.string().min(1).describe("https URL you opened, saw in search results, or found in the pack. Never news.google.com"),
  published_at: PublishedAt,
});

export type ProbabilityEstimate = z.infer<typeof ProbabilityEstimate>;
export type Source = z.infer<typeof Source>;
export type EvidenceSource = z.infer<typeof EvidenceSource>;
