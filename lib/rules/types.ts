import type { AgentContext } from "../schema/context";
import type { Source } from "../schema/common";
import type { DraftBrief } from "../schema/draft-brief";
import type { Forecast } from "../schema/forecast";
import type { Incident, IncidentBrief } from "../schema/incident";
import type { Strike } from "../schema/strike";
import type { CountryCode, Rung, Score } from "../vocab";

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
  hint: string | null;
}

/** An incident as the validator knows it: always the context fields, sometimes the full record. */
export type IncidentRecord = IncidentBrief & Partial<Omit<Incident, keyof IncidentBrief>>;

/** Existing records the draft can refer to. From content/ in the pipeline, or from the context alone. */
export interface World {
  incidents: IncidentRecord[];
  strikes: Strike[];
  forecasts: Forecast[];
}

export interface IndicatorView {
  tier: "incident" | "strategic" | "driver";
  countries: string[];
  status: "dormant" | "watch" | "active";
}

/** Values computed once per validation and shared by the rules. */
export interface Derived {
  sourcesById: Map<string, Source>;
  /** Existing incidents with today's updates applied, plus today's new incidents. */
  incidentsAfter: IncidentRecord[];
  incidentsById: Map<string, IncidentRecord>;
  strikesById: Map<string, Pick<Strike, "id" | "verification" | "damage" | "effect" | "sources">>;
  computedRung: Rung;
  floors: Record<CountryCode, { max_rung_30d: number; floor: Score }>;
  /** Indicator statuses after today's changes and additions. */
  indicatorsAfter: Map<string, IndicatorView>;
}

export interface RuleInput {
  draft: DraftBrief;
  /** The run date: the context's date, or the brief's own date in published mode. */
  date: string;
  /** Date taken from a YYYY-MM-DD.json file name, when there is one. */
  fileDate: string | null;
  /** Null in published mode, where the rules that need the state of the day before are skipped. */
  context: AgentContext | null;
  world: World | null;
  /** Normalized evidence URLs, or null when no evidence was given. */
  evidence: Set<string> | null;
  derived: Derived;
}

export type Rule = (input: RuleInput) => ValidationIssue[];

export function error(code: string, path: string, message: string, hint: string | null = null): ValidationIssue {
  return { code, severity: "error", path, message, hint };
}

export function warning(code: string, path: string, message: string, hint: string | null = null): ValidationIssue {
  return { code, severity: "warning", path, message, hint };
}

/** Distinct ids that resolve to a source in the brief. */
export function knownSourceIds(ids: string[], d: Derived): string[] {
  return [...new Set(ids)].filter((id) => d.sourcesById.has(id));
}

export function categoriesOf(ids: string[], d: Derived): Set<string> {
  return new Set(knownSourceIds(ids, d).map((id) => d.sourcesById.get(id)!.category));
}

export function list(items: readonly string[]): string {
  return items.join(", ");
}
