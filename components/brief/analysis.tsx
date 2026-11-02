import type { ReactNode } from "react";
import type { CategoryNote, CompetingExplanation, Development, Metric, NextEvent } from "@/lib/schema/draft-brief";
import type { Brief, PublishedWeeklyOutlook } from "@/lib/schema/brief";
import type { Forecast } from "@/lib/schema/forecast";
import { categoryLabel, dayMonth, metricValue, paragraphs, shortDate } from "@/lib/format";
import { CATEGORY_INFO, METRICS, NO_CHANGE_TEXT, type Importance } from "@/lib/vocab";
import { AttributionBadge, Chip, ImportanceTag, Pill, ProbabilityBadge, TONE_COLOR, Tag, VerificationBadge, type Tone } from "@/components/ui/badges";
import { SourceRefs, type SourceIndex } from "./sources";

const IMPORTANCE_TONE: Record<Importance, Tone> = { pivotal: "esc", major: "mix", notable: "neutral" };

/** A labelled line under a development, as ME Tracker's "Impact →" row. */
function Aside({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <div className="mt-1 grid items-start gap-2.5 text-[13px] leading-[1.5]" style={{ gridTemplateColumns: "auto 1fr" }}>
      <span className="pt-[3px] font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color }}>{label} →</span>
      <span className="text-soft">{children}</span>
    </div>
  );
}

/** One numbered development: index and chip, then category and importance, then the write-up. */
export function DevelopmentRow({ development: d, n, index, europe = true }: { development: Development; n: number; index: SourceIndex; europe?: boolean }) {
  const tone = IMPORTANCE_TONE[d.importance];
  const color = d.importance === "notable" ? (europe ? "var(--accent)" : "var(--ink-mute)") : TONE_COLOR[tone];
  const pivotal = d.importance === "pivotal";
  return (
    <article
      className="grid grid-cols-[32px_1fr] items-start gap-x-3 gap-y-2 border-b border-line py-[14px] pl-3 md:grid-cols-[44px_150px_1fr] md:gap-x-[18px]"
      style={{ borderLeft: `3px solid ${color}`, background: pivotal ? `color-mix(in srgb, ${color} 5%, transparent)` : undefined }}
    >
      <div className="flex flex-col items-start gap-1.5 pt-0.5">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted">{String(n).padStart(2, "0")}</span>
        <Chip color={color} size={10} />
      </div>
      <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start md:gap-1.5 md:pt-0.5">
        <span className="flex items-start gap-1.5 font-mono text-[10px] uppercase leading-[1.35] tracking-[0.1em] text-fg">
          <span className="mt-[3px]"><Chip color={color} size={6} /></span>{categoryLabel(d.category)}
        </span>
        <ImportanceTag importance={d.importance} />
        {d.attribution !== null ? <AttributionBadge level={d.attribution} /> : null}
        {d.verification !== null ? <VerificationBadge level={d.verification} /> : null}
      </div>
      <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
        <h3 className="display text-[19px] leading-[1.28] tracking-[-0.01em] text-fg md:text-[20px]" style={{ textWrap: "pretty" }}>{d.headline}</h3>
        <p className="text-[14px] leading-[1.55] text-soft" style={{ textWrap: "pretty" }}>{d.summary} <SourceRefs ids={d.source_ids} index={index} /></p>
        {d.incident_ids.length || d.strike_ids.length ? (
          <span className="kicker normal-case tracking-[0.06em]">{[...d.incident_ids, ...d.strike_ids].join(" · ")}</span>
        ) : null}
        {d.russian_framing ? <Aside label="Moscow says" color={color}>{d.russian_framing}</Aside> : null}
      </div>
    </article>
  );
}

export function CategoryNotes({ notes, index }: { notes: CategoryNote[]; index: SourceIndex }) {
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      {notes.map((n) => {
        const material = n.status === "material";
        return (
          <div key={n.category} className="border-b border-line py-2.5">
            <div className="flex items-center gap-2">
              <Chip color={material ? "var(--accent)" : "var(--rule-soft)"} />
              <span className={`kicker ${material ? "text-fg" : ""}`}>{CATEGORY_INFO[n.category].label}</span>
            </div>
            <p className={`mt-1 text-[13.5px] leading-[1.5] ${material ? "text-soft" : "text-muted italic"}`}>
              {material ? <>{n.text} <SourceRefs ids={n.source_ids} index={index} /></> : NO_CHANGE_TEXT}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Explanation({ e }: { e: CompetingExplanation }) {
  return (
    <div className="mt-4 max-w-[72ch] border border-line bg-panel px-4 py-3" style={{ borderLeft: "3px solid var(--amber)" }}>
      <p className="kicker text-fg">Competing explanations · {e.subject}</p>
      <ul className="mt-2 space-y-2">
        {e.hypotheses.map((h) => (
          <li key={h.label} className="text-[13.5px]">
            <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{h.label}</span> <ProbabilityBadge estimate={h.estimate} /></span>
            <span className="mt-0.5 block text-soft">{h.assessment}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Judgement({ judgement }: { judgement: Brief["judgement"] }) {
  return (
    <div>
      <div className="prose-serif">
        {paragraphs(judgement.text).map((p, i) => <p key={i} className="mt-3 first:mt-0">{p}</p>)}
      </div>
      {judgement.competing_explanations.map((e) => <Explanation key={e.subject} e={e} />)}
      <div className="mt-4 max-w-[72ch]">
        <Aside label="What would change our mind" color="var(--accent)">{judgement.change_my_mind}</Aside>
      </div>
    </div>
  );
}

function currentProbability(f: Forecast, before: string): number {
  return f.updates.filter((u) => u.date < before).at(-1)?.probability ?? f.probability;
}

function ForecastLine({ tag, question, children }: { tag: ReactNode; question: string; children: ReactNode }) {
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-line py-2.5 sm:grid-cols-[120px_1fr]">
      <span className="pt-0.5">{tag}</span>
      <span>
        <span className="display block text-[16px] leading-snug">{question}</span>
        <span className="kicker mt-1 block normal-case tracking-[0.06em]">{children}</span>
      </span>
    </li>
  );
}

export function ForecastChanges({ brief, forecastsById, index }: { brief: Brief; forecastsById: Record<string, Forecast>; index: SourceIndex }) {
  const { forecasts_new: added, forecast_updates: updated, forecast_resolutions: resolved } = brief;
  if (!added.length && !updated.length && !resolved.length) return <p className="kicker">No forecast changes today.</p>;
  return (
    <ul>
      {added.map((f) => (
        <ForecastLine key={f.id} tag={<Pill tone="mix">New</Pill>} question={f.question}>
          <span className="tabular text-[12px] text-fg">{f.probability}%</span> · base rate {f.base_rate}% · resolves by {shortDate(f.resolves_by)} · {f.id}
        </ForecastLine>
      ))}
      {updated.map((u) => {
        const f = forecastsById[u.id];
        return (
          <ForecastLine key={u.id} tag={<Pill tone="neutral">Updated</Pill>} question={f?.question ?? u.id}>
            <span className="tabular text-[12px] text-fg">{u.probability}%</span>{f ? ` (was ${currentProbability(f, brief.date)}%)` : ""} · {u.note}
          </ForecastLine>
        );
      })}
      {resolved.map((r) => {
        const f = forecastsById[r.id];
        return (
          <ForecastLine key={r.id} tag={<Pill tone={r.outcome === "yes" ? "esc" : "ok"}>Resolved {r.outcome}</Pill>} question={f?.question ?? r.id}>
            {r.note} <SourceRefs ids={[r.source_id]} index={index} />
            {f?.brier !== null && f?.brier !== undefined ? ` · Brier ${f.brier} (base rate ${f.brier_base})` : ""}
          </ForecastLine>
        );
      })}
    </ul>
  );
}

export function WeeklyOutlookView({ outlook }: { outlook: PublishedWeeklyOutlook }) {
  const horizon = (label: string, o: PublishedWeeklyOutlook["medium_term"]) => (
    <div className="border border-line bg-panel px-4 py-3" style={{ borderTop: "2px solid var(--ink)" }}>
      <p className="kicker text-accent">{label}</p>
      <p className="display mt-1 text-[19px] leading-[1.25]">{o.question}</p>
      <div className="mt-2"><ProbabilityBadge estimate={o.estimate} showConfidence /></div>
      {paragraphs(o.text).map((p, i) => <p key={i} className="mt-2 text-[13.5px] leading-[1.55] text-soft">{p}</p>)}
    </div>
  );
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {horizon("6 to 12 months", outlook.medium_term)}
        {horizon("2 to 5 years", outlook.long_term)}
      </div>
      <h3 className="kicker mt-6 mb-2 text-fg">Standing assumptions</h3>
      <ul>
        {outlook.assumptions_check.map((a) => (
          <li key={a.id} className="grid gap-x-4 gap-y-1 border-b border-line py-2 text-[13.5px] sm:grid-cols-[120px_1fr]">
            <span className="flex items-center gap-2"><span className="tabular text-[12px]">{a.id}</span> <Tag>{a.status}</Tag></span>
            <span>
              <span>{a.text}</span>
              <span className="mt-0.5 block text-[12.5px] text-muted">{a.note}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 max-w-[72ch]"><Aside label="Calibration" color="var(--amber)">{outlook.calibration_note}</Aside></div>
    </div>
  );
}

export function Next72h({ events }: { events: NextEvent[] }) {
  if (!events.length) return <p className="kicker">Nothing scheduled.</p>;
  return (
    <ul>
      {events.map((e) => (
        <li key={`${e.date}-${e.event}`} className="grid grid-cols-[64px_1fr] gap-3 border-b border-line py-2 text-[13.5px]">
          <span className="tabular pt-0.5 text-[12px] text-accent">{dayMonth(e.date)}</span>
          <span>{e.event} <span className="text-muted">{e.why}</span></span>
        </li>
      ))}
    </ul>
  );
}

export function MetricsTable({ metrics, index }: { metrics: Metric[]; index: SourceIndex }) {
  if (!metrics.length) return <p className="kicker">No metrics today.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {metrics.map((m) => (
        <div key={m.id} className="border border-line bg-panel px-3 py-2.5">
          <span className="kicker">{METRICS[m.id].label}</span>
          <span className="display mt-1 block text-[24px] leading-none">
            {m.value === null ? <span className="text-muted">n/a</span> : metricValue(m.value, m.unit)}
            <SourceRefs ids={m.source_ids} index={index} />
          </span>
          <span className="mt-1 block text-[12px] text-muted">{m.period}{m.note ? ` · ${m.note}` : ""}</span>
        </div>
      ))}
    </div>
  );
}
