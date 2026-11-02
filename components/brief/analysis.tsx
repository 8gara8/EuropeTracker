import type { CategoryNote, CompetingExplanation, Development, Metric, NextEvent } from "@/lib/schema/draft-brief";
import type { Brief, PublishedWeeklyOutlook } from "@/lib/schema/brief";
import type { Forecast } from "@/lib/schema/forecast";
import { categoryLabel, dayMonth, metricValue, paragraphs, shortDate } from "@/lib/format";
import { CATEGORY_INFO, METRICS, NO_CHANGE_TEXT } from "@/lib/vocab";
import { AttributionBadge, ImportanceTag, ProbabilityBadge, Tag, VerificationBadge } from "@/components/ui/badges";
import { SourceRefs, type SourceIndex } from "./sources";

export function DevelopmentCard({ development: d, index }: { development: Development; index: SourceIndex }) {
  return (
    <article className="rounded border border-line p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <ImportanceTag importance={d.importance} />
        <span className="text-muted">{categoryLabel(d.category)}</span>
      </div>
      <h3 className="mt-1 font-semibold leading-snug">{d.headline}</h3>
      <p className="mt-1 text-sm">{d.summary} <SourceRefs ids={d.source_ids} index={index} /></p>
      {d.attribution !== null || d.verification !== null ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {d.attribution !== null ? <><AttributionBadge level={d.attribution} /> {d.incident_ids.join(", ")}</> : null}
          {d.verification !== null ? <><VerificationBadge level={d.verification} /> {d.strike_ids.join(", ")}</> : null}
        </div>
      ) : null}
      {d.russian_framing ? <p className="mt-1.5 text-sm text-muted"><span className="font-semibold">Russian framing:</span> {d.russian_framing}</p> : null}
    </article>
  );
}

export function CategoryNotes({ notes, index }: { notes: CategoryNote[]; index: SourceIndex }) {
  return (
    <dl className="divide-y divide-line rounded border border-line text-sm">
      {notes.map((n) => (
        <div key={n.category} className="grid gap-x-3 px-3 py-1.5 sm:grid-cols-[13rem_1fr]">
          <dt className={n.status === "material" ? "font-semibold" : "text-muted"}>
            {CATEGORY_INFO[n.category].label}
          </dt>
          <dd className={n.status === "material" ? "" : "text-muted"}>
            {n.status === "material" ? <>{n.text} <SourceRefs ids={n.source_ids} index={index} /></> : NO_CHANGE_TEXT}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Explanation({ e }: { e: CompetingExplanation }) {
  return (
    <div className="mt-3 rounded border border-line bg-panel p-3 text-sm">
      <p className="font-semibold">Competing explanations: {e.subject}</p>
      <ul className="mt-1 space-y-1.5">
        {e.hypotheses.map((h) => (
          <li key={h.label}>
            <span className="font-semibold">{h.label}</span> <ProbabilityBadge estimate={h.estimate} />
            <span className="block text-muted">{h.assessment}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Judgement({ judgement }: { judgement: Brief["judgement"] }) {
  return (
    <div className="text-[15px]">
      {paragraphs(judgement.text).map((p, i) => <p key={i} className="mt-2 first:mt-0">{p}</p>)}
      {judgement.competing_explanations.map((e) => <Explanation key={e.subject} e={e} />)}
      <p className="mt-3 text-sm"><span className="font-semibold">What would change our mind:</span> {judgement.change_my_mind}</p>
    </div>
  );
}

function currentProbability(f: Forecast, before: string): number {
  return f.updates.filter((u) => u.date < before).at(-1)?.probability ?? f.probability;
}

export function ForecastChanges({ brief, forecastsById, index }: { brief: Brief; forecastsById: Record<string, Forecast>; index: SourceIndex }) {
  const { forecasts_new: added, forecast_updates: updated, forecast_resolutions: resolved } = brief;
  if (!added.length && !updated.length && !resolved.length) return <p className="text-sm text-muted">No forecast changes today.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {added.map((f) => (
        <li key={f.id}>
          <Tag>new</Tag> <span className="font-semibold">{f.question}</span>
          <span className="block text-xs text-muted">
            <span className="tabular font-semibold text-fg">{f.probability}%</span> · base rate {f.base_rate}% · resolves by {shortDate(f.resolves_by)} · {f.id}
          </span>
        </li>
      ))}
      {updated.map((u) => {
        const f = forecastsById[u.id];
        return (
          <li key={u.id}>
            <Tag>updated</Tag> <span className="font-semibold">{f?.question ?? u.id}</span>
            <span className="block text-xs text-muted">
              <span className="tabular font-semibold text-fg">{u.probability}%</span>
              {f ? ` (was ${currentProbability(f, brief.date)}%)` : ""} · {u.note}
            </span>
          </li>
        );
      })}
      {resolved.map((r) => {
        const f = forecastsById[r.id];
        return (
          <li key={r.id}>
            <Tag>resolved {r.outcome}</Tag> <span className="font-semibold">{f?.question ?? r.id}</span>
            <span className="block text-xs text-muted">
              {r.note} <SourceRefs ids={[r.source_id]} index={index} />
              {f?.brier !== null && f?.brier !== undefined ? ` · Brier ${f.brier} (base rate ${f.brier_base})` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function WeeklyOutlookView({ outlook }: { outlook: PublishedWeeklyOutlook }) {
  const horizon = (label: string, o: PublishedWeeklyOutlook["medium_term"]) => (
    <div className="mt-3 first:mt-0">
      <p className="text-sm font-semibold">{label}: {o.question} <ProbabilityBadge estimate={o.estimate} showConfidence /></p>
      {paragraphs(o.text).map((p, i) => <p key={i} className="mt-1 text-sm">{p}</p>)}
    </div>
  );
  return (
    <div>
      {horizon("6 to 12 months", outlook.medium_term)}
      {horizon("2 to 5 years", outlook.long_term)}
      <h3 className="mt-4 text-sm font-semibold">Standing assumptions</h3>
      <ul className="mt-1 space-y-1.5 text-sm">
        {outlook.assumptions_check.map((a) => (
          <li key={a.id}>
            <span className="font-semibold">{a.id}</span> <Tag>{a.status}</Tag>{" "}
            <span>{a.text}</span>
            <span className="block text-xs text-muted">{a.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm"><span className="font-semibold">Calibration:</span> {outlook.calibration_note}</p>
    </div>
  );
}

export function Next72h({ events }: { events: NextEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted">Nothing scheduled.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {events.map((e) => (
        <li key={`${e.date}-${e.event}`} className="flex gap-3">
          <span className="tabular w-14 shrink-0 font-semibold">{dayMonth(e.date)}</span>
          <span>{e.event} <span className="text-muted">{e.why}</span></span>
        </li>
      ))}
    </ul>
  );
}

export function MetricsTable({ metrics, index }: { metrics: Metric[]; index: SourceIndex }) {
  if (!metrics.length) return <p className="text-sm text-muted">No metrics today.</p>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-line">
        {metrics.map((m) => (
          <tr key={m.id}>
            <td className="py-1 pr-2">{METRICS[m.id].label}<span className="block text-xs text-muted">{m.period}{m.note ? ` · ${m.note}` : ""}</span></td>
            <td className="tabular py-1 text-right align-top font-semibold whitespace-nowrap">
              {m.value === null ? <span className="font-normal text-muted">n/a</span> : metricValue(m.value, m.unit)}
              <SourceRefs ids={m.source_ids} index={index} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
