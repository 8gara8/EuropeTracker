import type { ReactNode } from "react";
import type { ProbabilityEstimate } from "@/lib/schema/common";
import { ATTRIBUTION, COUNTRY_SCORES, PROBABILITY_TERMS, RUNGS, VERIFICATION, type Importance, type IndicatorStatus, type Rung, type Score, type Trend } from "@/lib/vocab";

// Small labelled badges. Color is never the only signal: every badge carries its meaning as text.

const base = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold leading-tight whitespace-nowrap";

export function RungBadge({ rung, size = "sm" }: { rung: Rung; size?: "sm" | "md" }) {
  const info = RUNGS[rung]!;
  return (
    <span className={base} style={{ background: `var(--rung-${rung})`, color: "#fff" }} title={`Rung ${rung}, ${info.name}: ${info.qualifies}`}>
      Rung {rung}{size === "md" ? ` · ${info.name}` : ""}
    </span>
  );
}

const WHITE_TEXT_TERMS = new Set(["highly_likely", "almost_certain"]);

export function ProbabilityBadge({ estimate, showConfidence = false }: { estimate: ProbabilityEstimate; showConfidence?: boolean }) {
  const { label } = PROBABILITY_TERMS[estimate.term];
  return (
    <span
      className={base}
      style={{ background: `var(--p-${estimate.term})`, color: WHITE_TEXT_TERMS.has(estimate.term) ? "#fff" : "var(--on-light)" }}
      title={`${label}, ${estimate.probability}%, ${estimate.confidence} confidence`}
    >
      {label} · {estimate.probability}%{showConfidence ? ` · ${estimate.confidence}` : ""}
    </span>
  );
}

export function ScoreBadge({ score }: { score: Score }) {
  const info = COUNTRY_SCORES[score];
  return (
    <span className={base} style={{ background: `var(--score-${score})`, color: "#fff" }} title={info.anchor}>
      {score} {info.label}
    </span>
  );
}

export function AttributionBadge({ level }: { level: 1 | 2 | 3 | 4 }) {
  const info = ATTRIBUTION[level];
  return (
    <span className={`${base} border border-line text-fg`} title={`Attribution ${level} of 4: ${info.means}`}>
      {info.label} <span className="font-normal text-muted">{level}/4</span>
    </span>
  );
}

export function VerificationBadge({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
  const info = VERIFICATION[level];
  return (
    <span className={`${base} border border-line text-fg`} title={`Verification ${level} of 5: ${info.means}`}>
      {info.label} <span className="font-normal text-muted">{level}/5</span>
    </span>
  );
}

const TREND = {
  up: { mark: "▲", text: "up", color: "var(--risk-up)" },
  down: { mark: "▼", text: "down", color: "var(--risk-down)" },
  flat: { mark: "▬", text: "flat", color: "var(--muted)" },
} as const;

export function TrendArrow({ trend }: { trend: Trend }) {
  const t = TREND[trend];
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap" style={{ color: t.color }}>
      <span aria-hidden="true">{t.mark}</span> {t.text}
    </span>
  );
}

export function Tag({ children, title }: { children: ReactNode; title?: string }) {
  return <span className={`${base} bg-panel text-muted border border-line font-medium`} title={title}>{children}</span>;
}

const STATUS = {
  dormant: { bg: "transparent", fg: "var(--muted)", border: "var(--border)" },
  watch: { bg: "#fde68a", fg: "var(--on-light)", border: "#fde68a" },
  active: { bg: "#dc2626", fg: "#fff", border: "#dc2626" },
} as const;

export function StatusBadge({ status }: { status: IndicatorStatus }) {
  const s = STATUS[status];
  return (
    <span className={`${base} border capitalize`} style={{ background: s.bg, color: s.fg, borderColor: s.border }}>
      {status}
    </span>
  );
}

const IMPORTANCE = {
  pivotal: { bg: "#7f1d1d", fg: "#fff" },
  major: { bg: "#d97706", fg: "#fff" },
  notable: { bg: "transparent", fg: "var(--muted)" },
} as const;

export function ImportanceTag({ importance }: { importance: Importance }) {
  const s = IMPORTANCE[importance];
  return (
    <span className={`${base} capitalize ${importance === "notable" ? "border border-line" : ""}`} style={{ background: s.bg, color: s.fg }}>
      {importance}
    </span>
  );
}
