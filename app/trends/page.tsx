import type { Metadata } from "next";
import { MonthlyBars } from "@/components/charts";
import { NextRungOddsChart, PathwayOddsGrid, PeriodBars, RangeSwitch, RungChart, ScoreStrip, SeriousTimeline } from "@/components/charts/trends";
import { Empty, PageHeader, Section } from "@/components/layout/chrome";
import { monthlyCounts, pathwayCounts } from "@/lib/aggregate";
import { loadContent } from "@/lib/content";
import { countryName, dayMonth, pathwayLabel, shortDate } from "@/lib/format";
import { asOfDate } from "@/lib/site-data";
import { metricHistory, nextRungOdds, pathwayOdds, rungHistory, scoreChanges, scoreHistory, weeklyCounts } from "@/lib/trends";
import { IMPACT_LABELS, PATHWAYS, SEED_START, type PathwayId } from "@/lib/vocab";

export const metadata: Metadata = { title: "Trends" };

const th = "border-b border-rule py-1.5 pr-2 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted";
const td = "border-b border-line py-1.5 pr-2 align-top";

/** One rung chart at two sizes: rung names beside the scale from tablet width up, numbers only on phones. */
function RungView({ points, trackingStart, label, ticks }: { points: ReturnType<typeof rungHistory>; trackingStart: string | null; label: string; ticks: "month" | "year" }) {
  return (
    <>
      <div className="md:hidden"><RungChart points={points} trackingStart={trackingStart} ariaLabel={label} ticks={ticks} height={160} /></div>
      <div className="hidden md:block"><RungChart points={points} trackingStart={trackingStart} ariaLabel={label} ticks={ticks} width={760} height={210} names wide /></div>
    </>
  );
}

export default function TrendsPage() {
  const content = loadContent();
  const { briefs, incidents, strikes, state } = content;
  const asOf = asOfDate(content);
  const first = briefs[0]?.date ?? null;
  const rung = rungHistory(incidents, briefs, SEED_START, asOf);
  const odds = nextRungOdds(briefs);
  const serious = incidents.filter((i) => i.serious && i.date <= asOf);
  const scores = scoreHistory(briefs.slice(-90));
  const changes = scoreChanges(briefs).slice(-12).reverse();
  const weekly = weeklyCounts(strikes, asOf).slice(-26);
  const drones = metricHistory(briefs.slice(-60), "ru_drones_launched");
  const counts = pathwayCounts(incidents, asOf);
  const pwOdds = Object.fromEntries(PATHWAYS.map((p) => [p, pathwayOdds(briefs, p)])) as Record<PathwayId, ReturnType<typeof pathwayOdds>>;

  return (
    <>
      <PageHeader title="How the risk has moved" kicker={`Trends · data to ${shortDate(asOf)}`}>
        The rung and incident counts go back to February 2022, rebuilt from the incident database. Odds and
        country scores are the analyst's calls, so they start with the first daily brief{first ? ` on ${shortDate(first)}` : ""} and
        grow by one point every morning.
      </PageHeader>

      <Section id="ladder" number={1} title="Spillover ladder" right="Highest rung in the previous 30 days">
        <RangeSwitch options={[
          { key: "m3", label: "3 months", content: <RungView points={rung.slice(-91)} trackingStart={first} label="Spillover rung by day over the past 3 months" ticks="month" /> },
          { key: "m12", label: "12 months", content: <RungView points={rung.slice(-365)} trackingStart={first} label="Spillover rung by day over the past 12 months" ticks="month" /> },
          { key: "all", label: "Since 2022", content: <RungView points={rung} trackingStart={first} label="Spillover rung by day since February 2022" ticks="year" /> },
        ]} />
        <div className="mt-6 grid gap-x-7 gap-y-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="kicker text-fg">Odds of the next rung</h3>
            {odds.length ? <NextRungOddsChart points={odds} ariaLabel="30-day odds of the next rung, by brief" /> : <Empty>The line starts with the first brief.</Empty>}
            <p className="text-[12.5px] leading-[1.5] text-muted">Our 30-day probability of an incident one rung higher. They are for the rung above the current one, so they jump when the rung changes.</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="kicker text-fg">Serious incidents since 2022</h3>
            {serious.length ? <SeriousTimeline incidents={serious} from={SEED_START} to={asOf} ariaLabel="Serious incidents since February 2022, by date and rung" /> : <Empty>No serious incident in the database.</Empty>}
            <p className="text-[12.5px] leading-[1.5] text-muted">{serious.length} incidents met their pathway's serious threshold. Hover a dot for the incident.</p>
          </div>
        </div>
      </Section>

      <Section id="pathways" number={2} title="Pathways" right="30-day odds of a serious incident, by brief">
        {briefs.length ? <PathwayOddsGrid series={pwOdds} ariaLabel="Odds of a serious incident by pathway and brief" /> : <Empty>The panels start with the first brief.</Empty>}
        <h3 className="kicker mt-6 mb-2 text-fg">Incidents per month by pathway</h3>
        <MonthlyBars months={monthlyCounts(incidents, asOf)} ariaLabel="Incidents per month by pathway since February 2022" />
        <h3 className="kicker mt-6 mb-2 text-fg">Base rates · {shortDate(asOf)}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr><th className={th}>Pathway</th><th className={`${th} text-right`}>Last 30 days</th><th className={`${th} text-right`}>Baseline / month</th><th className={`${th} text-right`}>Average / month since Feb 2022</th><th className={`${th} text-right`}>Serious, 12 months</th><th className={th}>Impact</th></tr>
            </thead>
            <tbody>
              {PATHWAYS.map((p) => {
                const c = counts[p];
                const impact = state.pathways.find((x) => x.pathway === p)!.impact;
                return (
                  <tr key={p}>
                    <td className={`${td} font-semibold`}>{pathwayLabel(p)}</td>
                    <td className={`${td} tabular text-right`}>{c.incidents_30d}</td>
                    <td className={`${td} tabular text-right`}>{c.baseline_monthly}</td>
                    <td className={`${td} tabular text-right`}>{c.monthly_avg_since_2022}</td>
                    <td className={`${td} tabular text-right`}>{c.serious_12m}</td>
                    <td className={`${td} text-xs text-muted`}>{impact}: {IMPACT_LABELS[impact]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="countries" number={3} title="Frontline countries" right={scores[0]?.points.length ? `Score in the last ${scores[0].points.length} briefs` : undefined}>
        {scores.some((r) => r.points.length) ? (
          <div className="grid gap-x-7 gap-y-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ScoreStrip rows={scores} ariaLabel="Frontline-country scores by brief" />
            <div>
              <h3 className="kicker mb-1 text-fg">Latest changes</h3>
              {changes.length ? (
                <ul className="divide-y divide-line border-y border-line text-sm">
                  {changes.map((c) => (
                    <li key={`${c.date}-${c.country}`} className="flex justify-between gap-3 py-1.5">
                      <span>{countryName(c.country)}</span>
                      <span className="tabular font-mono text-[12px] text-soft">{c.from} → {c.to} · {dayMonth(c.date)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No score has changed since the first brief.</p>}
            </div>
          </div>
        ) : <Empty>The strip starts with the first brief.</Empty>}
      </Section>

      <Section id="war" number={4} title="Pressure from the war" right="The drivers of the spillover risk">
        <div className="grid gap-x-7 gap-y-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="kicker text-fg">Ukrainian deep strikes into Russia · per week</h3>
            {weekly.length ? (
              <PeriodBars bars={weekly.map((w) => ({ date: w.week, label: dayMonth(w.week), value: w.count }))} color="var(--accent)"
                ariaLabel="Ukrainian deep strikes into Russia per week" describe={(b) => `Week of ${b.label}: ${b.value} ${b.value === 1 ? "strike" : "strikes"}`} />
            ) : <Empty>No strikes recorded yet.</Empty>}
            <p className="text-[12.5px] leading-[1.5] text-muted">From the strike database; weeks start on Monday, and the current week is partial.</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="kicker text-fg">Russian drones launched at Ukraine · per night</h3>
            {drones.some((d) => d.value !== null) ? (
              <PeriodBars bars={drones.map((d) => ({ date: d.date, label: dayMonth(d.date), value: d.value }))} color="var(--ink-soft)"
                ariaLabel="Russian drones launched per night, by brief" describe={(b) => (b.value === null ? `${b.label}: no figure that day` : `${b.label}: ${b.value} drones`)} />
            ) : <Empty>No brief has reported this figure yet.</Empty>}
            <p className="text-[12.5px] leading-[1.5] text-muted">As each brief reported it. A dot means no figure that day.</p>
          </div>
        </div>
      </Section>
    </>
  );
}
