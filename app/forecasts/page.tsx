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

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "resolved", value: String(summary.n) },
          { label: "mean Brier", value: summary.mean_brier?.toFixed(3) ?? "–" },
          { label: "base-rate Brier", value: summary.mean_brier_base?.toFixed(3) ?? "–" },
        ].map((s) => (
          <div key={s.label} className="rounded border border-line bg-panel p-2">
            <div className="tabular text-xl font-bold">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>
      {skill !== null ? (
        <p className="mt-2 text-sm text-muted">
          Skill against base rates: <span className="tabular font-semibold text-fg">{(skill * 100).toFixed(0)}%</span>
          {summary.n < 20 ? " (too few resolved forecasts to judge calibration)" : ""}
        </p>
      ) : null}

      <Section title={`Open (${open.length})`}>
        {open.length === 0 ? <Empty>No open forecasts.</Empty> : (
          <ul className="divide-y divide-line">
            {open.map((f) => (
              <li key={f.id} className="py-2.5 text-sm">
                <p className="font-semibold">{f.question}</p>
                <p className="mt-0.5 text-xs text-muted">
                  <span className="tabular text-base font-bold text-fg">{current(f)}%</span>
                  {f.updates.length ? ` (opened at ${f.probability}%)` : ""} · base rate {f.base_rate}% · resolves by {shortDate(f.resolves_by)} · {f.horizon}
                  {f.pathway ? ` · ${pathwayLabel(f.pathway)}` : ""} · {f.id}
                </p>
                <p className="mt-0.5 text-xs text-muted">Resolves yes if: {f.resolution_criteria}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Resolved (${closed.length})`}>
        {closed.length === 0 ? <Empty>No forecasts have resolved yet.</Empty> : (
          <ul className="divide-y divide-line">
            {closed.map((f) => (
              <li key={f.id} className="py-2.5 text-sm">
                <p><Tag>{OUTCOME[f.status]}</Tag> <span className="font-semibold">{f.question}</span></p>
                <p className="mt-0.5 text-xs text-muted">
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
