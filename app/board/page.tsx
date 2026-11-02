import type { Metadata } from "next";
import { LineChart, HeatGrid } from "@/components/charts";
import { LadderGauge } from "@/components/brief/board";
import { EasternFlank, PathwayBars, RiskMatrix, SpilloverGauge } from "@/components/brief/overview";
import { Empty, PageHeader, Section } from "@/components/layout/chrome";
import { ProbabilityBadge, ScoreBadge, TrendArrow } from "@/components/ui/badges";
import { pathwayCounts } from "@/lib/aggregate";
import { loadContent } from "@/lib/content";
import { countryName, dayMonth, PATHWAY_SHORT, pathwayLabel, shortDate } from "@/lib/format";
import { asOfDate } from "@/lib/site-data";
import { IMPACT_LABELS, PATHWAYS, TIER1 } from "@/lib/vocab";

export const metadata: Metadata = { title: "Spillover board" };

const th = "border-b border-rule py-1.5 pr-2 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted";
const td = "border-b border-line py-1.5 pr-2 align-top";

export default function BoardPage() {
  const content = loadContent();
  const { briefs, state, incidents } = content;
  const latest = briefs.at(-1);
  const asOf = asOfDate(content);
  const recent = briefs.slice(-30);
  const counts = pathwayCounts(incidents, asOf);

  const changes = (country: string) => briefs.flatMap((b) => b.board.countries
    .filter((c) => c.country === country && c.previous_score !== null && c.previous_score !== c.score)
    .map((c) => ({ date: b.date, from: c.previous_score!, to: c.score })));

  return (
    <>
      <PageHeader title="Spillover board" kicker={state.as_of === "seed" ? "Starting values" : `Current scores · ${shortDate(state.as_of)}`}>
        {state.as_of === "seed" ? "Starting values, before the first brief." : `The ladder, pathway odds and country scores from the brief of ${shortDate(state.as_of)}.`}
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_1fr]">
        <LadderGauge current={state.ladder.current_rung} previous={state.ladder.current_rung} nextOdds={state.ladder.next_rung_odds} />
        {latest ? (
          <div className="flex flex-col gap-4">
            <SpilloverGauge current={latest.board.ladder.current_rung} previous={latest.board.ladder.previous_rung} nextOdds={latest.board.ladder.next_rung_odds} rationale={null} pathways={latest.board.pathways} />
            <div>
              <p className="kicker text-fg">Why rung {latest.board.ladder.current_rung}</p>
              <p className="prose-serif mt-2 text-[16px]">{latest.board.ladder.rationale}</p>
            </div>
          </div>
        ) : (
          <ul className="border border-line bg-panel">
            {state.pathways.map((p) => (
              <li key={p.pathway} className="flex flex-wrap items-center gap-x-2 border-b border-line px-3 py-2 last:border-b-0">
                <span className="min-w-0 flex-1 font-semibold">{PATHWAY_SHORT[p.pathway]}</span>
                <TrendArrow trend={p.trend} />
                <ProbabilityBadge estimate={p.serious_odds} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {latest ? (
        <>
          <Section title="Where the risk sits" right="30-day odds of a serious incident × how bad it would be">
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-7">
              <EasternFlank countries={latest.board.countries} index={{}} />
              <RiskMatrix pathways={latest.board.pathways} />
            </div>
            <h3 className="kicker mt-6 mb-1 text-fg">The seven pathways</h3>
            <PathwayBars pathways={latest.board.pathways} computed={latest.computed.pathways} />
          </Section>
        </>
      ) : null}

      <Section title="Ladder history" note="The highest rung reached in the 30 days before each brief.">
        {briefs.length ? (
          <LineChart series={[{ name: "Rung", points: briefs.map((b) => ({ x: b.date, y: b.board.ladder.current_rung })) }]}
            yMin={0} yMax={6} yTicks={[0, 2, 4, 6]} step ariaLabel="Spillover ladder rung by brief date" />
        ) : <Empty>The history starts with the first brief.</Empty>}
      </Section>

      <Section title="Odds of the next rung" note="30-day probability of any incident above the current rung.">
        {briefs.some((b) => b.board.ladder.next_rung_odds) ? (
          <LineChart series={[{ name: "Next-rung odds", points: briefs.filter((b) => b.board.ladder.next_rung_odds).map((b) => ({ x: b.date, y: b.board.ladder.next_rung_odds!.probability })) }]}
            yMin={0} yMax={100} yTicks={[0, 25, 50, 75, 100]} yLabel={(v) => `${v}%`} ariaLabel="30-day odds of the next rung by brief date" />
        ) : <Empty>The history starts with the first brief.</Empty>}
      </Section>

      <Section title="Pathways over the last 30 briefs" note="30-day odds of a serious incident in each pathway, on the probability scale.">
        {recent.length ? (
          <HeatGrid
            rows={PATHWAYS.map((p) => ({ key: p, label: PATHWAY_SHORT[p] }))}
            columns={recent.map((b) => b.date)}
            cells={Object.fromEntries(PATHWAYS.map((p) => [p, Object.fromEntries(recent.map((b) => {
              const s = b.board.pathways.find((x) => x.pathway === p);
              return [b.date, s ? { term: s.serious_odds.term, title: `${s.serious_odds.probability}%, ${s.trend}` } : null];
            }))]))}
            ariaLabel="Serious-incident odds by pathway and brief date"
          />
        ) : <Empty>The grid fills in as briefs arrive.</Empty>}
      </Section>

      <Section title="Frontline countries" note="Score changes are listed with the brief that made them.">
        <ul className="divide-y divide-line rounded border border-line text-sm">
          {TIER1.map((code) => {
            const s = state.countries.find((c) => c.country === code)!;
            const history = changes(code).slice(-4).reverse();
            return (
              <li key={code} className="px-3 py-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-28 font-semibold">{countryName(code)}</span>
                  <ScoreBadge score={s.score} />
                  <span className="text-xs text-muted">since {shortDate(s.since)}</span>
                </div>
                {history.length ? (
                  <p className="mt-0.5 text-xs text-muted">{history.map((h) => `${dayMonth(h.date)}: ${h.from} → ${h.to}`).join(" · ")}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Base rates" note={`Incidents in the database, as of ${shortDate(asOf)}. Every pathway score starts from these.`}>
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
    </>
  );
}
