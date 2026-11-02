import { z } from "zod";
import { Category, ID_PATTERNS, IsoDate, IsoTimestamp, Language, SourceCategory, Window } from "./common";

// The source registry, `research/sources.yaml` (SPEC §4.12), and the daily source pack (§4.13).

const FeedBase = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, { error: "Feed ids are lower-case letters, digits and hyphens" }),
  name: z.string().min(1),
  coverage: z.array(Category).min(1),
  priority: z.literal([1, 2, 3]),
};

export const Feed = z.discriminatedUnion("kind", [
  z.strictObject({ ...FeedBase, kind: z.literal("telegram"), channel: z.string().regex(/^[A-Za-z0-9_]+$/), category: SourceCategory, language: Language }),
  z.strictObject({ ...FeedBase, kind: z.literal("rss"), url: z.url({ protocol: /^https?$/ }), category: SourceCategory, language: Language }),
  z.strictObject({ ...FeedBase, kind: z.literal("gnews"), query: z.string().min(1), hl: z.string().min(2), gl: z.string().regex(/^[A-Z]{2}$/) }),
]);

export const SourceRegistry = z.strictObject({
  schema_version: z.literal(1),
  domains: z.record(z.string().min(3), SourceCategory),
  keywords: z.array(z.string().min(2)),
  feeds: z.array(Feed),
});

export const PackItem = z.strictObject({
  id: z.string().regex(ID_PATTERNS.packItem),
  feed_id: z.string(),
  outlet: z.string(),
  category: z.union([SourceCategory, z.literal("unclassified")]),
  language: z.string(),
  coverage: z.array(Category),
  title: z.string().max(200),
  url: z.string().min(1),
  lead_only: z.boolean(),
  published_at: IsoTimestamp,
  snippet: z.string().max(300),
  score: z.number(),
});

export const Pack = z.strictObject({
  schema_version: z.literal(1),
  date: IsoDate,
  window: Window,
  generated_at: IsoTimestamp,
  degraded: z.boolean(),
  feeds: z.array(z.strictObject({
    id: z.string(),
    ok: z.boolean(),
    items_total: z.int().min(0),
    items_kept: z.int().min(0),
    error: z.string().nullable(),
  })),
  items: z.array(PackItem).max(350),
});

export type Feed = z.infer<typeof Feed>;
export type SourceRegistry = z.infer<typeof SourceRegistry>;
export type PackItem = z.infer<typeof PackItem>;
export type Pack = z.infer<typeof Pack>;
