import type { Metadata } from "next";
import { Empty, PageHeader, Section } from "@/components/layout/chrome";
import { Tag } from "@/components/ui/badges";
import { brierSummary } from "@/lib/aggregate";
import { loadContent } from "@/lib/content";
import { pathwayLabel, shortDate } from "@/lib/format";
import type { Forecast } from "@/lib/schema/forecast";

export const metadata: Metadata = { title: "Forecasts" };

const current = (f: Forecast) => f.updates.at(-1)?.probability ?? f.probability;

const OUTCOME: Record<Forecast["status"], string> = { open: "open", resolved_yes: "yes", resolved_no: "no", annulled: "annulled" };

export default function ForecastsPage() {
  const { forecasts } = loadContent();
  const open = forecasts.filter((f) => f.status === "open").sort((a, b) => a.resolves_by.localeCompare(b.resolves_by));
  const closed = forecasts.filter((f) => f.status !== "open").sort((a, b) => (b.resolved_on ?? "").localeCompare(a.resolved_on ?? ""));
  const summary = brierSummary(forecasts);
  const skill = summary.mean_brier !== null && summary.mean_brier_base ? 1 - summary.mean_brier / summary.mean_brier_base : null;

  return (
    <>
      <PageHeader title="Forecasts">
        Every forecast is binary and dated. Resolved forecasts are scored with the Brier score (0 is perfect, lower is better)
        and compared with a forecaster who uses only base rates.
      </PageHeader>

      <div className="grid grid-cols-3 border border-rule bg-panel" style={{ borderLeft: "3px solid var(--accent)" }}>
        {[
          { label: "resolved", value: String(summary.n) },
          { label: "mean Brier", value: summary.mean_brier?.toFixed(3) ?? "–" },
          { label: "base-rate Brier", value: summary.mean_brier_base?.toFixed(3) ?? "–" },
        ].map((s) => (
          <div key={s.label} className="border-r border-line px-[18px] py-[14px] last:border-r-0">
            <div className="kicker">{s.label}</div>
            <div className="display mt-1 text-[28px] leading-none">{s.value}</div>
          </div>
        ))}
      </div>
      {skill !== null ? (
        <p className="mt-2 text-sm text-muted">
          Skill against base rates: <span className="tabular text-fg">{(skill * 100).toFixed(0)}%</span>
          {summary.n < 20 ? " (too few resolved forecasts to judge calibration)" : ""}
        </p>
      ) : null}

      <Section title={`Open (${open.length})`}>
        {open.length === 0 ? <Empty>No open forecasts.</Empty> : (
          <ul className="border-t border-line">
            {open.map((f) => (
              <li key={f.id} className="grid gap-x-5 gap-y-1 border-b border-line py-3 md:grid-cols-[90px_1fr]">
                <span className="display text-[30px] leading-none" style={{ color: current(f) >= 55 ? "var(--accent)" : current(f) >= 40 ? "var(--amber)" : "var(--ink)" }}>{current(f)}%</span>
                <div>
                <p className="display text-[17px] leading-snug">{f.question}</p>
                <p className="kicker mt-1 normal-case tracking-[0.06em]">
                  {f.updates.length ? ` (opened at ${f.probability}%)` : ""} · base rate {f.base_rate}% · resolves by {shortDate(f.resolves_by)} · {f.horizon}
                  {f.pathway ? ` · ${pathwayLabel(f.pathway)}` : ""} · {f.id}
                </p>
                <p className="mt-1 text-[12.5px] text-soft">Resolves yes if: {f.resolution_criteria}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Resolved (${closed.length})`}>
        {closed.length === 0 ? <Empty>No forecasts have resolved yet.</Empty> : (
          <ul className="border-t border-line">
            {closed.map((f) => (
              <li key={f.id} className="border-b border-line py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2"><Tag>{OUTCOME[f.status]}</Tag> <span className="display text-[17px]">{f.question}</span></p>
                <p className="kicker mt-1 normal-case tracking-[0.06em]">
                  Final forecast {current(f)}% · base rate {f.base_rate}%
                  {f.brier !== null ? <> · Brier <span className="tabular font-semibold text-fg">{f.brier.toFixed(3)}</span> (base rate {f.brier_base?.toFixed(3)})</> : ""}
                  {f.resolved_on ? ` · ${shortDate(f.resolved_on)}` : ""}
                </p>
                {f.resolution_note ? <p className="mt-0.5 text-xs">{f.resolution_note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
