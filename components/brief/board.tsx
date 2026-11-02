import type { BriefComputed } from "@/lib/schema/brief";
import type { ProbabilityEstimate } from "@/lib/schema/common";
import type { CountryScore, PathwayScore } from "@/lib/schema/draft-brief";
import { countryName, pathwayLabel } from "@/lib/format";
import { IMPACT_LABELS, PATHWAY_INFO, RUNGS, type Rung } from "@/lib/vocab";
import { ProbabilityBadge, RungBadge, ScoreBadge, Tag, TrendArrow } from "@/components/ui/badges";
import { SourceRefs, type SourceIndex } from "./sources";

export interface LadderGaugeProps { current: Rung; previous: Rung; nextOdds: ProbabilityEstimate | null; compact?: boolean }

/** The seven rungs from 6 at the top to 0 at the bottom, with the current rung marked. */
export function LadderGauge({ current, previous, nextOdds, compact = false }: LadderGaugeProps) {
  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <RungBadge rung={current} size="md" />
        {nextOdds ? <span className="text-xs text-muted">next rung: <ProbabilityBadge estimate={nextOdds} /></span> : null}
      </span>
    );
  }
  return (
    <ol className="overflow-hidden rounded border border-line" aria-label={`Spillover ladder: rung ${current}`}>
      {[...RUNGS].reverse().map(({ rung, name }) => {
        const isCurrent = rung === current;
        const isNext = rung === current + 1;
        return (
          <li
            key={rung}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-1.5 text-sm last:border-b-0 ${isCurrent ? "font-semibold" : rung > current ? "text-muted" : ""}`}
            style={isCurrent ? { background: `color-mix(in srgb, var(--rung-${rung}) 14%, transparent)` } : undefined}
            aria-current={isCurrent ? "true" : undefined}
          >
            <span
              className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold"
              style={rung <= current ? { background: `var(--rung-${rung})`, color: "#fff" } : { border: `2px solid var(--rung-${rung})`, color: `var(--rung-${rung})` }}
            >
              {rung}
            </span>
            <span className="min-w-0 flex-1">{name}</span>
            {isCurrent ? <span className="text-xs">◀ now{previous !== current ? ` (was ${previous})` : ""}</span> : null}
            {isNext && nextOdds ? <span className="basis-full pl-9 text-xs font-normal text-muted">Odds of reaching it within 30 days: <ProbabilityBadge estimate={nextOdds} /></span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function PathwayTable({ pathways, computed, index }: { pathways: PathwayScore[]; computed: BriefComputed["pathways"] | null; index: SourceIndex }) {
  return (
    <ul className="divide-y divide-line rounded border border-line">
      {pathways.map((p) => {
        const c = computed?.[p.pathway];
        return (
          <li key={p.pathway} className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold" title={PATHWAY_INFO[p.pathway].counts}>{pathwayLabel(p.pathway)}</span>
              <TrendArrow trend={p.trend} />
              <span className="ml-auto"><ProbabilityBadge estimate={p.serious_odds} /></span>
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {c ? <span>{c.incidents_30d} in 30 days vs {c.baseline_monthly} a month at baseline · </span> : null}
              impact {p.impact}: {IMPACT_LABELS[p.impact]}
            </div>
            <p className="mt-1 text-sm">{p.rationale} <SourceRefs ids={p.source_ids} index={index} /></p>
          </li>
        );
      })}
    </ul>
  );
}

export function CountryTable({ countries, index }: { countries: CountryScore[]; index: SourceIndex }) {
  return (
    <ul className="divide-y divide-line rounded border border-line">
      {countries.map((c) => {
        const change = c.previous_score === null ? null : c.score - c.previous_score;
        return (
          <li key={c.country} className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-sm">
            <span className="w-28 shrink-0 font-semibold">{countryName(c.country)}</span>
            <ScoreBadge score={c.score} />
            {change ? (
              <span className="text-xs font-semibold" style={{ color: change > 0 ? "var(--risk-up)" : "var(--risk-down)" }}>
                {change > 0 ? "▲" : "▼"} from {c.previous_score}
              </span>
            ) : null}
            {c.cohesion_flag ? <Tag title="Veto, energy deal or sanctions block in play">cohesion risk</Tag> : null}
            {c.reason ? <span className="basis-full text-xs text-muted sm:basis-auto sm:flex-1">{c.reason} <SourceRefs ids={c.source_ids} index={index} /></span> : null}
          </li>
        );
      })}
    </ul>
  );
}
