import type { ProbabilityEstimate } from "./schema/common";
import { taipeiTime } from "./dates";
import {
  CATEGORY_INFO, COUNTRY_NAMES, PATHWAY_INFO, PROBABILITY_TERMS, SOURCE_CATEGORIES, incidentTypeInfo,
  type CategoryId, type PathwayId, type SourceCategoryId,
} from "./vocab";

// Display formatting shared by pages and components.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(date: string): { y: number; m: number; d: number; dow: number } {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "Wednesday 28 October 2026" */
export function longDate(date: string): string {
  const { y, m, d, dow } = parts(date);
  return `${DAYS[dow]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "28 Oct 2026" */
export function shortDate(date: string): string {
  const { y, m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
}

/** "28 Oct" */
export function dayMonth(date: string): string {
  const { m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]!.slice(0, 3)}`;
}

/** "Oct 2026" for "2026-10" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
}

/** "27 Oct 05:30 – 28 Oct 05:30 Taipei" */
export function windowLabel(w: { start: string; end: string }): string {
  return `${dayMonth(w.start.slice(0, 10))} ${taipeiTime(w.start)} – ${dayMonth(w.end.slice(0, 10))} ${taipeiTime(w.end)} Taipei`;
}

export function termLabel(term: ProbabilityEstimate["term"]): string {
  return PROBABILITY_TERMS[term].label;
}

/** "unlikely (30%)", the form STYLE.md §7 uses in prose. */
export function probabilityText(e: ProbabilityEstimate): string {
  return `${termLabel(e.term).toLowerCase()} (${e.probability}%)`;
}

export function countryName(code: string): string {
  return (COUNTRY_NAMES as Record<string, string>)[code] ?? code;
}

export function countryList(codes: readonly string[]): string {
  return codes.map(countryName).join(", ");
}

/** Short pathway names for chart rows and legends. */
export const PATHWAY_SHORT: Record<PathwayId, string> = {
  airspace: "Airspace", sabotage: "Sabotage", maritime: "Maritime", cyber_ew: "Cyber and EW",
  military_pressure: "Military pressure", nuclear: "Nuclear", political_economic: "Political and economic",
};

export function pathwayLabel(id: PathwayId): string {
  return PATHWAY_INFO[id].label;
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORY_INFO[id].label;
}

export function sourceCategoryLabel(id: SourceCategoryId): string {
  return SOURCE_CATEGORIES[id].label;
}

export function incidentTypeLabel(pathway: PathwayId, type: string): string {
  return incidentTypeInfo(pathway, type)?.label ?? type.replace(/_/g, " ");
}

/** A metric value with its unit: "142", "94.1%", "66.4 USD/bbl", "18 km²". */
export function metricValue(value: number, unit: string): string {
  const n = Number.isInteger(value) ? value.toLocaleString("en-GB") : value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  if (unit === "count") return n;
  if (unit === "%") return `${n}%`;
  if (unit === "km2") return `${n} km²`;
  return `${n} ${unit}`;
}

/** RFC 822 date for RSS. */
export function rfc822(timestamp: string): string {
  return new Date(timestamp).toUTCString();
}

/** Splits judgement-style text into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
