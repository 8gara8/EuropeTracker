import type { Content } from "@/lib/content";
import { archiveMap, indexBy, neighbours } from "@/lib/site-data";
import type { BriefViewProps } from "./BriefView";

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
    assumptionsById: indexBy(content.state.assumptions),
    archive: archiveMap(content),
    prevDate: prev,
    nextDate: next,
  };
}
