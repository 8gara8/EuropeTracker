import { z } from "zod";
import { DraftBrief } from "./schema/draft-brief";

// The JSON Schema the research agent writes against, generated from the Zod DraftBrief schema.

export const DRAFT_SCHEMA_PATH = "routine/schema/draft-brief.schema.json";

/**
 * JSON with short objects and arrays kept on one line. About a quarter smaller than 2-space
 * pretty-printing, and no line is long enough for the agent's file reader to truncate.
 */
export function printJson(value: unknown, indent = "", width = 110): string {
  const flat = JSON.stringify(value);
  if (value === null || typeof value !== "object" || flat.length + indent.length <= width) return flat;
  const next = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map((v) => next + printJson(v, next, width)).join(",\n")}\n${indent}]`;
  const entries = Object.entries(value as Record<string, unknown>);
  return `{\n${entries.map(([k, v]) => `${next}${JSON.stringify(k)}: ${printJson(v, next, width)}`).join(",\n")}\n${indent}}`;
}

export function renderDraftSchema(): string {
  const { $schema, ...rest } = z.toJSONSchema(DraftBrief, { target: "draft-2020-12" }) as Record<string, unknown>;
  const doc = {
    $schema,
    title: "EuropeTracker DraftBrief",
    description: "The research agent's output, drafts/YYYY-MM-DD.json (SPEC.md §4.4). Generated from lib/schema by `npm run schema:gen`; do not edit by hand. Word budgets in descriptions are enforced by the validator.",
    ...rest,
  };
  return `${printJson(doc)}\n`;
}
