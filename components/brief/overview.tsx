import type { CSSProperties } from "react";
import type { BriefComputed } from "@/lib/schema/brief";
import type { ProbabilityEstimate } from "@/lib/schema/common";
import type { CountryScore, PathwayScore } from "@/lib/schema/draft-brief";
import { countryName, PATHWAY_SHORT } from "@/lib/format";
import { COUNTRY_SCORES, IMPACT_LABELS, PROBABILITY_TERMS, RUNGS, type PathwayId, type Rung } from "@/lib/vocab";
import { Chip, TONE_COLOR, TrendArrow, termTone } from "@/components/ui/badges";
import { SourceRefs, type SourceIndex } from "./sources";

// The brief's overview, beyond ME Tracker's gauges: a spillover gauge, the eastern flank as a tile
// map, and the seven pathways as a probability-by-impact risk matrix. Every chart has its numbers in
// text or a data table, so colour and position are never the only signal.

const kicker = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted";

/** The rung as a large numeral over a stepped 0–6 ladder, with the odds of the next rung and the hottest pathway. */
export function SpilloverGauge({ current, previous, nextOdds, rationale, pathways }: {
  current: Rung; previous: Rung | null; nextOdds: ProbabilityEstimate | null; rationale: string | null; pathways: PathwayScore[];
}) {
  const top = [...pathways].sort((a, b) => b.serious_odds.probability - a.serious_odds.probability)[0];
  const change = previous === null || previous === current ? "→ unchanged since yesterday" : previous < current ? `↗ up from rung ${previous}` : `↘ down from rung ${previous}`;
  const firstSentence = rationale?.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? rationale;
  return (
    <aside aria-label={`Spillover ladder: rung ${current} of ${RUNGS.length - 1}`} className="flex flex-col gap-3.5 border border-rule bg-panel px-[22px] pt-5 pb-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className={kicker}>Spillover ladder</span>
        <span className={`${kicker} text-right ${previous !== null && previous !== current ? "text-accent" : ""}`}>{change}</span>
      </div>
      <div className="flex items-end gap-4">
        <span className="display text-[96px] leading-[0.8] md:text-[112px]" style={{ color: `var(--rung-${current})` }}>{current}</span>
        <div className="flex flex-col gap-1 pb-1.5">
          <span className="display text-[22px] leading-[1.12] md:text-[24px]">{RUNGS[current]!.name}</span>
          <span className="text-[13px] text-soft">of {RUNGS.length - 1} rungs{firstSentence ? `. ${firstSentence}` : "."}</span>
        </div>
      </div>
      <div className="grid grid-cols-7 items-end gap-1" aria-hidden="true">
        {RUNGS.map(({ rung }) => (
          <div key={rung} className="flex flex-col items-stretch gap-1">
            <div
              style={{
                height: 16 + rung * 9,
                background: rung <= current ? `var(--rung-${rung})` : "transparent",
                border: rung <= current ? undefined : `1px dashed var(--rung-${rung})`,
                opacity: rung === current ? 1 : rung < current ? 0.5 : 0.75,
                boxShadow: rung === current ? "inset 0 -3px 0 var(--ink)" : undefined,
              }}
            />
            <span className={`tabular text-center text-[11px] ${rung === current ? "font-bold text-accent" : "text-muted"}`}>{rung}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <div className="flex flex-col gap-0.5">
          <span className={kicker}>{current < 6 ? `Rung ${current + 1} within 30 days` : "Top of the ladder"}</span>
          {nextOdds ? (
            <span className="display text-[28px] leading-tight" style={{ color: TONE_COLOR[termTone(nextOdds.term)] }}>
              {nextOdds.probability}% <span className="text-[15px] font-medium lowercase">{PROBABILITY_TERMS[nextOdds.term].label}</span>
            </span>
          ) : <span className="display text-[28px] leading-tight">—</span>}
        </div>
        {top ? (
          <div className="flex flex-col gap-0.5">
            <span className={kicker}>Hottest pathway</span>
            <span className="display text-[28px] leading-tight" style={{ color: TONE_COLOR[termTone(top.serious_odds.term)] }}>
              {PATHWAY_SHORT[top.pathway]} <span className="text-[15px] font-medium">{top.serious_odds.probability}%</span>
            </span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

// The eastern flank, north to south, on a 3-column grid: [column, row].
const FLANK: Record<string, [number, number]> = { FI: [3, 1], EE: [3, 2], LV: [3, 3], LT: [2, 4], PL: [1, 5], MD: [3, 6], RO: [2, 7] };

/** The seven frontline countries as a tile map, shaded by score, with each score's reason below. */
export function EasternFlank({ countries, index }: { countries: CountryScore[]; index: SourceIndex }) {
  const withReasons = countries.filter((c) => c.reason);
  return (
    <div className="flex flex-col gap-3 border border-line bg-panel px-[18px] py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className={kicker}>Eastern flank · north to south</span>
        <span className={kicker}>score 1–5</span>
      </div>
      <ul className="grid grid-cols-3 gap-1.5" style={{ gridAutoRows: "62px" }} aria-label="Frontline country scores">
        {countries.map((c) => {
          const [col, row] = FLANK[c.country] ?? [1, 1];
          const strong = c.score >= 3;
          const color = `var(--score-${c.score})`;
          const change = c.previous_score === null ? 0 : c.score - c.previous_score;
          return (
            <li
              key={c.country}
              className="flex flex-col justify-between px-2.5 py-2"
              style={{ gridColumn: col, gridRow: row, background: strong ? color : "var(--card)", color: strong ? "var(--card)" : "var(--ink)", border: `1px solid ${color}`, boxShadow: strong ? undefined : `inset 0 3px 0 ${color}` }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-90">{countryName(c.country)}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="display text-[24px] leading-none">{c.score}</span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.08em]">{COUNTRY_SCORES[c.score].label}{change ? (change > 0 ? " ↗" : " ↘") : ""}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {withReasons.length ? (
        <ul className="flex flex-col gap-1.5 border-t border-line pt-2.5">
          {withReasons.map((c) => (
            <li key={c.country} className="text-[12.5px] leading-[1.45] text-soft">
              <span className="font-semibold text-fg">{countryName(c.country)} {c.score}.</span> {c.reason}{c.cohesion_flag ? " Cohesion risk." : ""} <SourceRefs ids={c.source_ids} index={index} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const MATRIX_NAME: Record<PathwayId, string> = {
  airspace: "Airspace", sabotage: "Sabotage", maritime: "Maritime", cyber_ew: "Cyber/EW",
  military_pressure: "Military", nuclear: "Nuclear", political_economic: "Political",
};

/** Pathways placed by 30-day odds (across) and impact (up); labels are staggered where they would collide. */
export function RiskMatrix({ pathways }: { pathways: PathwayScore[] }) {
  // Labels in the same impact row step up or down when they would overlap: within 14 points on a
  // wide plot, within 40 on a phone, where the plot is about 300 px across.
  const sorted = [...pathways].sort((a, b) => a.impact - b.impact || a.serious_odds.probability - b.serious_odds.probability);
  const stagger = (gap: number, steps: number[]) => {
    const out = new Map<PathwayId, number>();
    let k = 0;
    sorted.forEach((p, i) => {
      const prev = sorted[i - 1];
      const close = prev && prev.impact === p.impact && p.serious_odds.probability - prev.serious_odds.probability < gap;
      k = close ? k + 1 : 0;
      out.set(p.pathway, steps[k % steps.length]!);
    });
    return out;
  };
  const wide = stagger(14, [0, -17]);
  const narrow = stagger(40, [0, -17, 17]);
  const moved = pathways.filter((p) => p.trend !== "flat");
  return (
    <figure className="m-0 flex flex-col gap-2.5 border border-line bg-panel px-[18px] pt-4 pb-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={kicker}>Seven pathways · odds against impact</span>
        <span className={kicker}>{moved.length ? `${moved.length} moved 5 points or more` : "→ steady: no pathway moved 5 points"}</span>
      </div>
      <div className="pl-6">
        <div className="flex flex-col gap-1.5">
          <div
            role="img"
            aria-label={`Risk matrix: ${pathways.map((p) => `${PATHWAY_SHORT[p.pathway]} ${p.serious_odds.probability}% odds, impact ${p.impact}`).join("; ")}.`}
            className="relative h-[260px] border-b border-l border-rule md:h-[300px]"
            style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--green) 7%, transparent), color-mix(in srgb, var(--amber) 8%, transparent) 50%, color-mix(in srgb, var(--accent) 11%, transparent))" }}
          >
            {[20, 40, 60, 80].map((t) => <div key={t} className="absolute inset-x-0 border-t border-dotted border-line" style={{ top: `${t}%` }} aria-hidden="true" />)}
            {[5, 4, 3, 2, 1].map((impact) => (
              <span key={impact} aria-hidden="true" className="absolute -left-5 font-mono text-[10px] text-muted" style={{ top: `calc(${(5 - impact) * 20 + 10}% - 7px)` }}>{impact}</span>
            ))}
            <div className="absolute inset-y-0 left-1/2 border-l border-dotted border-line" aria-hidden="true" />
            {pathways.map((p) => {
              const color = TONE_COLOR[termTone(p.serious_odds.term)];
              const x = Math.max(1, Math.min(96, p.serious_odds.probability));
              const right = x > 62;
              return (
                <div
                  key={p.pathway}
                  className={`absolute top-[calc(var(--y)+var(--off-sm))] flex items-center gap-1.5 md:top-[calc(var(--y)+var(--off-md))] ${right ? "flex-row-reverse" : ""}`}
                  style={{
                    [right ? "right" : "left"]: right ? `calc(${100 - x}% - 6px)` : `calc(${x}% - 6px)`,
                    "--y": `calc(${(5 - p.impact) * 20 + 10}% - 9px)`,
                    "--off-sm": `${narrow.get(p.pathway) ?? 0}px`,
                    "--off-md": `${wide.get(p.pathway) ?? 0}px`,
                  } as CSSProperties}
                >
                  <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0" style={{ background: color, border: "2px solid var(--card)", boxShadow: `0 0 0 1px ${color}` }} />
                  <span className="text-[12px] font-semibold whitespace-nowrap md:text-[12.5px]">{MATRIX_NAME[p.pathway]}</span>
                  <span className="tabular text-[11px] text-soft">{p.serious_odds.probability}%</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between font-mono text-[10px] text-muted" aria-hidden="true">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
          <div className="flex justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            <span>↑ impact if it happens</span><span>30-day probability →</span>
          </div>
        </div>
      </div>
      <details className="kicker mt-1">
        <summary className="cursor-pointer">Data table: pathway odds and impact</summary>
        <table className="tabular mt-2 w-full text-[11px] normal-case tracking-normal text-fg">
          <thead><tr className="text-muted"><th className="py-1 pr-2 text-left font-normal">Pathway</th><th className="py-1 pr-2 text-right font-normal">30-day odds</th><th className="py-1 text-left font-normal">Impact</th></tr></thead>
          <tbody>
            {pathways.map((p) => (
              <tr key={p.pathway} className="border-t border-line">
                <td className="py-1 pr-2">{PATHWAY_SHORT[p.pathway]}</td>
                <td className="py-1 pr-2 text-right">{p.serious_odds.probability}%</td>
                <td className="py-1">{p.impact} · {IMPACT_LABELS[p.impact]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Each pathway's odds as a bar, with its trend, counts and rationale. Rows on phones, cards on wide screens. */
export function PathwayBars({ pathways, computed, index }: { pathways: PathwayScore[]; computed: BriefComputed["pathways"] | null; index?: SourceIndex }) {
  return (
    <ul className="grid grid-cols-1 gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
      {pathways.map((p) => {
        const tone = termTone(p.serious_odds.term);
        const color = TONE_COLOR[tone];
        const c = computed?.[p.pathway];
        return (
          <li key={p.pathway} className="flex flex-col gap-2 border-b border-line py-3 lg:border lg:border-line lg:bg-panel lg:px-3 lg:mb-3" style={{ borderTop: `3px solid ${color}` }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg">{PATHWAY_SHORT[p.pathway]}</span>
              <TrendArrow trend={p.trend} />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="display text-[18px] leading-tight" style={{ color: tone === "neutral" ? "var(--ink)" : color }}>{PROBABILITY_TERMS[p.serious_odds.term].label}</span>
              <span className="tabular text-[13px]">{p.serious_odds.probability}%</span>
            </div>
            <div className="h-1.5 bg-deep" aria-hidden="true"><div className="h-1.5" style={{ width: `${p.serious_odds.probability}%`, background: color }} /></div>
            <span className="font-mono text-[10.5px] text-soft">
              {c ? `${c.incidents_30d} in 30 days · ${c.baseline_monthly}/mo baseline · ` : ""}impact {p.impact}
            </span>
            <p className="text-[12.5px] leading-[1.5] text-soft">{p.rationale}{index ? <> <SourceRefs ids={p.source_ids} index={index} /></> : null}</p>
          </li>
        );
      })}
      <li className="hidden flex-col justify-end gap-1 border border-dashed border-line px-3 py-3 lg:mb-3 lg:flex">
        <span className={kicker}>Probability scale</span>
        {(Object.keys(PROBABILITY_TERMS) as (keyof typeof PROBABILITY_TERMS)[]).map((t) => (
          <span key={t} className="flex items-center gap-2 text-[11.5px] text-soft">
            <Chip color={TONE_COLOR[termTone(t)]} size={7} />{PROBABILITY_TERMS[t].label}
            <span className="tabular ml-auto text-muted">{PROBABILITY_TERMS[t].min}–{PROBABILITY_TERMS[t].max}%</span>
          </span>
        ))}
      </li>
    </ul>
  );
}
