import { monthlyCounts } from "@/lib/aggregate";
import type { Content } from "@/lib/content";
import { addDays } from "@/lib/dates";
import { archiveMap, indexBy, neighbours } from "@/lib/site-data";
import { nextRungOdds, rollingCounts, rungHistory, scoreChanges, scoreHistory, yearOnYear } from "@/lib/trends";
import { PATHWAYS, type PathwayId } from "@/lib/vocab";
import type { BriefViewProps } from "./BriefView";
import type { BriefTrends } from "./trends";

/** Everything BriefView needs for one date, or null when there is no brief for it. */
export function briefPropsFor(content: Content, date: string): BriefViewProps | null {
  const brief = content.briefs.find((b) => b.date === date);
  if (!brief) return null;
  const { prev, next } = neighbours(content, date);
  return {
    brief,
    incidentsById: indexBy(content.incidents),
    strikesById: indexBy(content.strikes),
    forecastsById: indexBy(content.forecasts),
    indicatorsById: indexBy(content.state.indicators),
    archive: archiveMap(content),
    prevDate: prev,
    nextDate: next,
    trends: trendsFor(content, date),
  };
}

/** The trend series as they stood on `date`: briefs and incidents up to that day only. */
export function trendsFor(content: Content, date: string): BriefTrends {
  const briefs = content.briefs.filter((b) => b.date <= date);
  const incidents = content.incidents.filter((i) => i.date <= date);
  const yearAgo = addDays(date, -364);
  return {
    rung: rungHistory(incidents, briefs, yearAgo, date),
    trackingStart: content.briefs[0]?.date ?? null,
    odds: nextRungOdds(briefs),
    months: monthlyCounts(incidents, date),
    scores: scoreHistory(briefs.slice(-30)),
    changes: scoreChanges(briefs),
    sparklines: Object.fromEntries(PATHWAYS.map((p) => [p, rollingCounts(incidents, p, yearAgo, date)])) as Record<PathwayId, { date: string; count: number }[]>,
    yearOnYear: yearOnYear(incidents, date),
  };
}
