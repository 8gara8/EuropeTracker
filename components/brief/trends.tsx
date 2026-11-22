import Link from "next/link";
import type { ReactNode } from "react";
import { MonthlyBars } from "@/components/charts";
import { NextRungOddsChart, RungChart, ScoreStrip } from "@/components/charts/trends";
import { countryName, dayMonth, shortDate } from "@/lib/format";
import { daysAtRung, type OddsPoint, type RungPoint, type ScoreRow } from "@/lib/trends";
import type { PathwayId, Score, Tier1Country } from "@/lib/vocab";

/** What the "How it's moving" section needs, up to and including the brief's date (built in props.ts). */
export interface BriefTrends {
  /** The rung for each of the last 365 days. */
  rung: RungPoint[];
  /** The first brief's date. */
  trackingStart: string | null;
  odds: OddsPoint[];
  months: { month: string; counts: Partial<Record<PathwayId, number>> }[];
  /** Scores in the last 30 briefs. */
  scores: ScoreRow[];
  changes: { date: string; country: Tier1Country; from: Score; to: Score }[];
  /** Incidents in each pathway's previous 30 days, weekly over the last year. */
  sparklines: Record<PathwayId, { date: string; count: number }[]>;
  yearOnYear: { last12: number; prior12: number };
}

function Panel({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="kicker text-fg">{title}</h3>
      {children}
      {note ? <p className="text-[12.5px] leading-[1.5] text-muted">{note}</p> : null}
    </div>
  );
}

/** The trend charts on every brief: how the rung, the odds, incident counts and country scores have moved. */
export function TrendsOverview({ trends: t }: { trends: BriefTrends }) {
  const days = daysAtRung(t.rung);
  const atRungs = (Object.entries(days) as [string, number][])
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([r, n]) => `rung ${r} on ${n} ${n === 1 ? "day" : "days"}`);
  const since = t.trackingStart ? dayMonth(t.trackingStart) : null;
  const recent = t.changes.slice(-6);

  return (
    <div className="flex flex-col gap-5">
      <p className="kicker text-soft">
        Past 12 months: {atRungs.join(", ")} · {t.yearOnYear.last12} incidents, against {t.yearOnYear.prior12} in the 12 months before
      </p>
      <div className="grid gap-x-7 gap-y-6 lg:grid-cols-2">
        <Panel
          title="Spillover rung · past 12 months"
          note={since ? `The highest rung in the previous 30 days. Before ${since}, when the daily briefs began, it is rebuilt from the incident database with the same rule.` : "The highest rung in the previous 30 days, from the incident database."}
        >
          <RungChart points={t.rung} trackingStart={t.trackingStart} ariaLabel="Spillover rung by day over the past 12 months" />
        </Panel>
        {t.odds.length ? (
          <Panel title={`Odds of the next rung · since ${since}`} note="Our 30-day probability of an incident one rung higher. They are for the rung above the current one, so they jump when the rung changes.">
            <NextRungOddsChart points={t.odds} ariaLabel="30-day odds of the next rung, by brief" />
          </Panel>
        ) : null}
        <Panel title="Incidents per month by pathway · since Feb 2022">
          <MonthlyBars months={t.months} ariaLabel="Incidents per month by pathway since February 2022" />
        </Panel>
        {t.scores.some((r) => r.points.length) ? (
          <Panel
            title={`Frontline countries · last ${t.scores[0]!.points.length} ${t.scores[0]!.points.length === 1 ? "brief" : "briefs"}`}
            note={recent.length ? `Changes: ${recent.map((c) => `${countryName(c.country)} ${c.from}→${c.to} on ${dayMonth(c.date)}`).join(" · ")}` : `No score has changed since ${since}.`}
          >
            <ScoreStrip rows={t.scores} ariaLabel="Frontline-country scores by brief" />
          </Panel>
        ) : null}
      </div>
      <p className="text-[13px]">
        <Link href="/trends">All trends since 2022, with the war's drivers →</Link>
        {t.rung.length ? <span className="text-muted"> · data to {shortDate(t.rung.at(-1)!.date)}</span> : null}
      </p>
    </div>
  );
}
