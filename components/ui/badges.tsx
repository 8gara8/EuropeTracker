import type { ReactNode } from "react";
import type { ProbabilityEstimate } from "@/lib/schema/common";
import { ATTRIBUTION, COUNTRY_SCORES, PROBABILITY_TERMS, RUNGS, VERIFICATION, type Importance, type IndicatorStatus, type ProbabilityTerm, type Rung, type Score, type Trend } from "@/lib/vocab";

// Labelled pills in ME Tracker's style: square, mono, uppercase, with a colour chip. Colour is never
// the only signal: every pill carries its meaning as text.

export type Tone = "esc" | "mix" | "ok" | "neutral";

export const TONE_COLOR: Record<Tone, string> = { esc: "var(--accent)", mix: "var(--amber)", ok: "var(--green)", neutral: "var(--ink-mute)" };
export const TONE_BG: Record<Tone, string> = { esc: "var(--badge-esc)", mix: "var(--badge-mix)", ok: "var(--badge-ok)", neutral: "var(--badge-neutral)" };

/** How alarming a probability term is, for its colour. */
export function termTone(term: ProbabilityTerm): Tone {
  if (term === "remote" || term === "highly_unlikely") return "ok";
  if (term === "unlikely") return "neutral";
  if (term === "realistic_possibility") return "mix";
  return "esc";
}

export function rungTone(rung: number): Tone {
  return rung >= 4 ? "esc" : rung === 3 ? "mix" : rung <= 1 ? "ok" : "neutral";
}

export function scoreTone(score: number): Tone {
  return score >= 4 ? "esc" : score === 3 ? "mix" : score === 1 ? "ok" : "neutral";
}

/** A square colour chip. */
export function Chip({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className="inline-block shrink-0" style={{ width: size, height: size, background: color }} />;
}

export function Pill({ tone = "neutral", color, children, title }: { tone?: Tone; color?: string; children: ReactNode; title?: string }) {
  const c = color ?? TONE_COLOR[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[11px] uppercase leading-none tracking-[0.08em] whitespace-nowrap"
      style={{ color: c, background: TONE_BG[tone], borderColor: `color-mix(in srgb, ${c} 30%, transparent)` }}
      title={title}
    >
      <Chip color={c} size={6} />
      {children}
    </span>
  );
}

export function RungBadge({ rung, size = "sm" }: { rung: Rung; size?: "sm" | "md" }) {
  const info = RUNGS[rung]!;
  return (
    <Pill tone={rungTone(rung)} color={`var(--rung-${rung})`} title={`Rung ${rung}, ${info.name}: ${info.qualifies}`}>
      Rung {rung}{size === "md" ? ` · ${info.name}` : ""}
    </Pill>
  );
}

export function ProbabilityBadge({ estimate, showConfidence = false }: { estimate: ProbabilityEstimate; showConfidence?: boolean }) {
  const { label } = PROBABILITY_TERMS[estimate.term];
  return (
    <Pill tone={termTone(estimate.term)} title={`${label}, ${estimate.probability}%, ${estimate.confidence} confidence`}>
      {label} · {estimate.probability}%{showConfidence ? ` · ${estimate.confidence}` : ""}
    </Pill>
  );
}

export function ScoreBadge({ score }: { score: Score }) {
  const info = COUNTRY_SCORES[score];
  return (
    <Pill tone={scoreTone(score)} color={`var(--score-${score})`} title={info.anchor}>
      {score} · {info.label}
    </Pill>
  );
}

export function AttributionBadge({ level }: { level: 1 | 2 | 3 | 4 }) {
  const info = ATTRIBUTION[level];
  return <Pill tone={level >= 3 ? "esc" : level === 2 ? "mix" : "neutral"} title={`Attribution ${level} of 4: ${info.means}`}>{info.label} · {level}/4</Pill>;
}

export function VerificationBadge({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
  const info = VERIFICATION[level];
  return <Pill tone={level >= 4 ? "ok" : level === 3 ? "mix" : "neutral"} title={`Verification ${level} of 5: ${info.means}`}>{info.label} · {level}/5</Pill>;
}

const TREND = {
  up: { mark: "↗", text: "rising", color: "var(--risk-up)" },
  down: { mark: "↘", text: "easing", color: "var(--risk-down)" },
  flat: { mark: "→", text: "steady", color: "var(--ink-mute)" },
} as const;

export function TrendArrow({ trend }: { trend: Trend }) {
  const t = TREND[trend];
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] whitespace-nowrap" style={{ color: t.color }}>
      <span aria-hidden="true">{t.mark}</span> {t.text}
    </span>
  );
}

export function Tag({ children, title }: { children: ReactNode; title?: string }) {
  return <Pill tone="neutral" title={title}>{children}</Pill>;
}

export function StatusBadge({ status }: { status: IndicatorStatus }) {
  return <Pill tone={status === "active" ? "esc" : status === "watch" ? "mix" : "neutral"}>{status}</Pill>;
}

/** Importance as a mono label; pivotal items are red and marked with ◆. */
export function ImportanceTag({ importance }: { importance: Importance }) {
  const pivotal = importance === "pivotal";
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap"
      style={{ color: pivotal ? "var(--accent)" : importance === "major" ? "var(--ink)" : "var(--ink-mute)", fontWeight: pivotal || importance === "major" ? 700 : 400 }}
    >
      {importance}{pivotal ? " ◆" : ""}
    </span>
  );
}
