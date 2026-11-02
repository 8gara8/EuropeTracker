import type { BriefComputed } from "@/lib/schema/brief";
import type { ProbabilityEstimate } from "@/lib/schema/common";
import type { CountryScore, PathwayScore } from "@/lib/schema/draft-brief";
import { countryName, PATHWAY_SHORT } from "@/lib/format";
import { COUNTRY_SCORES, IMPACT_LABELS, PATHWAY_INFO, PROBABILITY_TERMS, RUNGS, type ProbabilityTerm, type Rung, type Trend } from "@/lib/vocab";
import { Chip, ProbabilityBadge, RungBadge, TONE_COLOR, TrendArrow, scoreTone, termTone } from "@/components/ui/badges";
import { SourceRefs, type SourceIndex } from "./sources";

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

const TERM_ORDER = Object.keys(PROBABILITY_TERMS) as ProbabilityTerm[];

/** A 180° dial of twelve segments, filled to the probability (ME Tracker's clock dial). */
function Dial({ probability, color }: { probability: number; color: string }) {
  const SEGS = 12;
  const pct = Math.max(0, Math.min(1, probability / 100));
  const filled = Math.max(1, Math.round(pct * SEGS));
  const [cx, cy, r0, r1] = [60, 56, 44, 56];
  const at = (a: number, r: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const needle = Math.PI + pct * Math.PI;
  return (
    <svg viewBox="0 0 120 62" width="100%" height={58} className="block" aria-hidden="true">
      {Array.from({ length: SEGS }, (_, i) => {
        const a0 = Math.PI + (i / SEGS) * Math.PI;
        const a1 = Math.PI + ((i + 0.85) / SEGS) * Math.PI;
        const active = i < filled;
        return <path key={i} d={`M ${at(a0, r0)} L ${at(a0, r1)} L ${at(a1, r1)} L ${at(a1, r0)} Z`} fill={active ? color : "var(--rule-soft)"} opacity={active ? 0.55 + 0.4 * (i / SEGS) : 0.5} />;
      })}
      <line x1={cx} y1={cy} x2={cx + 40 * Math.cos(needle)} y2={cy + 40 * Math.sin(needle)} stroke="var(--ink)" strokeWidth={1.4} />
      <circle cx={cx} cy={cy} r={2.5} fill="var(--ink)" />
    </svg>
  );
}

/** One card per pathway: the dial, the probability word, trend, counts and rationale. */
export function PathwayDials({ pathways, computed, index }: { pathways: PathwayScore[]; computed: BriefComputed["pathways"] | null; index?: SourceIndex }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {pathways.map((p) => {
        const tone = termTone(p.serious_odds.term);
        const color = TONE_COLOR[tone];
        const c = computed?.[p.pathway];
        return (
          <div key={p.pathway} className="flex flex-col gap-2 border border-line bg-panel px-[14px] pt-[12px] pb-[12px]" style={{ borderTop: `3px solid ${color}` }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="kicker" title={PATHWAY_INFO[p.pathway].counts}>{PATHWAY_SHORT[p.pathway]}</span>
              <TrendArrow trend={p.trend as Trend} />
            </div>
            <Dial probability={p.serious_odds.probability} color={color} />
            <div className="flex items-baseline justify-between gap-2">
              <span className="display text-[21px] uppercase leading-none" style={{ color: tone === "neutral" ? "var(--ink)" : color }}>
                {PROBABILITY_TERMS[p.serious_odds.term].label}
              </span>
              <span className="tabular text-[13px] text-fg">{p.serious_odds.probability}%</span>
            </div>
            <div className="kicker normal-case tracking-[0.06em]">
              {c ? <>{c.incidents_30d} in 30 days · {c.baseline_monthly}/mo baseline · </> : null}impact {p.impact}
            </div>
            <p className="text-[12.5px] leading-[1.5] text-soft" title={IMPACT_LABELS[p.impact]}>
              {p.rationale}{index ? <> <SourceRefs ids={p.source_ids} index={index} /></> : null}
            </p>
          </div>
        );
      })}
      <div className="hidden flex-col justify-end gap-1 border border-dashed border-line px-[14px] py-[12px] lg:flex">
        <span className="kicker">Scale</span>
        {TERM_ORDER.map((t) => (
          <span key={t} className="flex items-center gap-2 text-[11.5px] text-soft">
            <Chip color={TONE_COLOR[termTone(t)]} size={7} />{PROBABILITY_TERMS[t].label} <span className="tabular ml-auto text-muted">{PROBABILITY_TERMS[t].min}–{PROBABILITY_TERMS[t].max}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** One tile per frontline country: the score, its change and the reason. */
export function CountryTiles({ countries, index }: { countries: CountryScore[]; index: SourceIndex }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {countries.map((c) => {
        const tone = scoreTone(c.score);
        const color = `var(--score-${c.score})`;
        const change = c.previous_score === null ? 0 : c.score - c.previous_score;
        return (
          <div key={c.country} className="flex flex-col gap-1 border border-line bg-panel px-3 py-[10px]" style={{ borderTop: `3px solid ${color}` }}>
            <span className="kicker truncate">{countryName(c.country)}</span>
            <span className="flex items-baseline gap-2">
              <span className="display text-[30px] leading-none" style={{ color }}>{c.score}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: tone === "neutral" ? "var(--ink-soft)" : color }}>{COUNTRY_SCORES[c.score].label}</span>
            </span>
            {change ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: change > 0 ? "var(--risk-up)" : "var(--risk-down)" }}>
                {change > 0 ? "↗ up" : "↘ down"} from {c.previous_score}
              </span>
            ) : null}
            {c.cohesion_flag ? <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-amber" title="Veto, energy deal or sanctions block in play">cohesion risk</span> : null}
            {c.reason ? <p className="text-[12px] leading-[1.45] text-soft">{c.reason} <SourceRefs ids={c.source_ids} index={index} /></p> : null}
          </div>
        );
      })}
    </div>
  );
}
