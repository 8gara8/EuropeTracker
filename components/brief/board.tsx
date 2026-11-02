import type { ProbabilityEstimate } from "@/lib/schema/common";
import { RUNGS, type Rung } from "@/lib/vocab";
import { ProbabilityBadge, RungBadge } from "@/components/ui/badges";

export interface LadderGaugeProps { current: Rung; previous: Rung; nextOdds: ProbabilityEstimate | null; compact?: boolean }

/** The seven rungs from 6 at the top to 0 at the bottom, with the current rung marked. */
export function LadderGauge({ current, previous, nextOdds, compact = false }: LadderGaugeProps) {
  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <RungBadge rung={current} size="md" />
        {nextOdds ? <span className="kicker">next rung <ProbabilityBadge estimate={nextOdds} /></span> : null}
      </span>
    );
  }
  return (
    <ol className="border border-rule bg-panel" aria-label={`Spillover ladder: rung ${current}`}>
      {[...RUNGS].reverse().map(({ rung, name }) => {
        const isCurrent = rung === current;
        const isNext = rung === current + 1;
        const reached = rung <= current;
        return (
          <li
            key={rung}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-[7px] last:border-b-0 ${isCurrent ? "" : rung > current ? "text-muted" : "text-soft"}`}
            style={isCurrent ? { background: `color-mix(in srgb, var(--rung-${rung}) 12%, transparent)`, boxShadow: `inset 3px 0 0 var(--rung-${rung})` } : undefined}
            aria-current={isCurrent ? "true" : undefined}
          >
            <span
              className="tabular flex h-6 w-6 shrink-0 items-center justify-center text-[12px] font-semibold"
              style={reached ? { background: `var(--rung-${rung})`, color: "var(--card)" } : { border: `1px solid var(--rung-${rung})`, color: `var(--rung-${rung})` }}
            >
              {rung}
            </span>
            <span className={`min-w-0 flex-1 ${isCurrent ? "display text-[17px]" : "text-[13.5px]"}`}>{name}</span>
            {isCurrent ? <span className="kicker text-accent">◀ now{previous !== current ? ` · was ${previous}` : ""}</span> : null}
            {isNext && nextOdds ? <span className="basis-full pl-9 text-[12px] text-muted">Odds of reaching it within 30 days: <ProbabilityBadge estimate={nextOdds} /></span> : null}
          </li>
        );
      })}
    </ol>
  );
}
