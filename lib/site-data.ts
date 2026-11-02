import type { Content } from "./content";
import { taipeiToday } from "./dates";
import { normalizeUrl } from "./urls";

// Small helpers the pages share for turning content into lookups.

export function indexBy<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((x) => [x.id, x]));
}

/** Normalized URL → Wayback snapshot. */
export function archiveMap(content: Content): Record<string, string> {
  return Object.fromEntries(Object.entries(content.archive).map(([url, v]) => [normalizeUrl(url), v.snapshot]));
}

/** The date pages compute "last 30 days" against: the latest brief, or today in Taipei. */
export function asOfDate(content: Content): string {
  return content.briefs.at(-1)?.date ?? taipeiToday();
}

export function neighbours(content: Content, date: string): { prev: string | null; next: string | null } {
  const dates = content.briefs.map((b) => b.date);
  const i = dates.indexOf(date);
  return { prev: i > 0 ? dates[i - 1]! : null, next: i >= 0 && i < dates.length - 1 ? dates[i + 1]! : null };
}
