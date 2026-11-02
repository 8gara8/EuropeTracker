import { computedRung, countryFloors, inLast30, nextIds, pathwayCounts } from "./aggregate";
import type { Content } from "./content";
import { addDays, inRange, isMonday, windowFor } from "./dates";
import type { AgentContext } from "./schema/context";
import { TIER1 } from "./vocab";

// Assembles the agent context (SPEC §4.14) from published content. scripts/build-context.ts writes it
// to drafts/context.json; the validator builds it in memory when no context file is given.

export interface ContextOptions {
  /** ISO timestamp by which the draft must be written. */
  deadline?: string;
  pack?: AgentContext["pack"];
}

export function buildContext(content: Content, date: string, opts: ContextOptions = {}): AgentContext {
  const floors = countryFloors(content.incidents, date);
  const before = content.briefs.filter((b) => b.date < date);
  return {
    date,
    window: windowFor(date),
    weekly: isMonday(date),
    deadline: opts.deadline ?? `${date}T06:45:00+08:00`,
    state: content.state,
    computed: {
      current_rung: computedRung(content.incidents, date),
      pathways: pathwayCounts(content.incidents, date),
      countries: Object.fromEntries(TIER1.map((c) => [c, floors[c]])) as AgentContext["computed"]["countries"],
      incidents_last_30d: content.incidents
        .filter((i) => inLast30(i, date))
        .map(({ id, date: d, affected, pathway, type, rung, attribution, summary }) =>
          ({ id, date: d, affected, pathway, type, rung, attribution, summary })),
    },
    next_ids: nextIds(content.incidents, content.strikes, content.forecasts, date),
    open_forecasts: content.forecasts.filter((f) => f.status === "open"),
    recent_briefs: before.slice(-3).map((b) => ({ date: b.date, title: b.title, bottom_line: b.bottom_line, judgement: b.judgement.text })),
    recent_strikes: content.strikes.filter((s) => inRange(s.date, addDays(date, -13), date)),
    active_assumptions: content.state.assumptions.filter((a) => a.status === "active"),
    pack: opts.pack ?? { md: "", json: "", degraded: false, failed_feeds: [] },
  };
}
