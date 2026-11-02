import Link from "next/link";
import type { Brief } from "@/lib/schema/brief";
import type { Forecast } from "@/lib/schema/forecast";
import type { Incident } from "@/lib/schema/incident";
import type { Assumption, Indicator } from "@/lib/schema/state";
import type { Strike } from "@/lib/schema/strike";
import { longDate, paragraphs, windowLabel } from "@/lib/format";
import { TAIWAN_NO_NEWS } from "@/lib/vocab";
import { Section } from "@/components/layout/chrome";
import { Tag } from "@/components/ui/badges";
import { CategoryNotes, DevelopmentCard, ForecastChanges, Judgement, MetricsTable, Next72h, WeeklyOutlookView } from "./analysis";
import { CountryTable, LadderGauge, PathwayTable } from "./board";
import { IncidentRow } from "@/components/incidents/IncidentRow";
import { StrikeRow } from "@/components/strikes/StrikeTable";
import { IncidentUpdates, IndicatorChanges, StrikeUpdates } from "./records";
import { SourceList, SourceRefs, sourceIndex } from "./sources";

export interface BriefViewProps {
  brief: Brief;
  incidentsById: Record<string, Incident>;
  strikesById: Record<string, Strike>;
  forecastsById: Record<string, Forecast>;
  indicatorsById: Record<string, Indicator>;
  assumptionsById: Record<string, Assumption>;
  archive: Record<string, string>;   // normalized URL → snapshot URL
  prevDate: string | null;
  nextDate: string | null;
}

/** The whole brief, in the order SPEC §6 sets. */
export function BriefView(props: BriefViewProps) {
  const { brief: b, incidentsById, strikesById, forecastsById, indicatorsById, assumptionsById, archive, prevDate, nextDate } = props;
  const index = sourceIndex(b.sources);
  const hasIndicators = b.indicator_changes.length + b.indicators_new.length > 0;

  return (
    <article>
      <header>
        <p className="text-sm text-muted">{longDate(b.date)}</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight">{b.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Covers {windowLabel(b.window)}</span>
          {b.quiet_day ? <Tag>quiet day</Tag> : null}
          {b.weekly ? <Tag>weekly outlook</Tag> : null}
        </div>
      </header>

      <div className="mt-5 rounded border-l-4 bg-panel p-4" style={{ borderColor: `var(--rung-${b.board.ladder.current_rung})` }}>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Bottom line</h2>
        <p className="mt-1 text-[17px] leading-relaxed">{b.bottom_line} <SourceRefs ids={b.bottom_line_source_ids} index={index} /></p>
      </div>

      <Section id="board" title="Spillover board">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
          <LadderGauge current={b.board.ladder.current_rung} previous={b.board.ladder.previous_rung} nextOdds={b.board.ladder.next_rung_odds} />
          <p className="text-sm">{b.board.ladder.rationale}</p>
        </div>
        <h3 className="mt-4 mb-2 text-sm font-semibold">Pathways: 30-day odds of a serious incident</h3>
        <PathwayTable pathways={b.board.pathways} computed={b.computed.pathways} index={index} />
        <h3 className="mt-4 mb-2 text-sm font-semibold">Frontline countries</h3>
        <CountryTable countries={b.board.countries} index={index} />
      </Section>

      {b.developments.length ? (
        <Section id="developments" title="Key developments">
          <div className="space-y-3">
            {b.developments.map((d) => <DevelopmentCard key={d.id} development={d} index={index} />)}
          </div>
        </Section>
      ) : null}

      {b.incidents_new.length || b.incident_updates.length ? (
        <Section id="incidents" title="New incidents in Europe">
          {b.incidents_new.length ? <ul className="divide-y divide-line">{b.incidents_new.map((x) => <IncidentRow key={x.id} incident={x} />)}</ul> : null}
          <IncidentUpdates updates={b.incident_updates} incidentsById={incidentsById} />
        </Section>
      ) : null}

      {b.strikes_new.length || b.strike_updates.length ? (
        <Section id="strikes" title="Deep strikes">
          {b.strikes_new.length ? <ul className="divide-y divide-line">{b.strikes_new.map((s) => <StrikeRow key={s.id} strike={s} />)}</ul> : null}
          <StrikeUpdates updates={b.strike_updates} strikesById={strikesById} />
        </Section>
      ) : null}

      <Section id="categories" title="All twelve categories">
        <CategoryNotes notes={b.categories} index={index} />
      </Section>

      {hasIndicators ? (
        <Section id="indicators" title="Warning indicators that moved">
          <IndicatorChanges changes={b.indicator_changes} added={b.indicators_new} indicatorsById={indicatorsById} index={index} />
        </Section>
      ) : null}

      <Section id="judgement" title="Judgement">
        <Judgement judgement={b.judgement} />
      </Section>

      <Section id="forecasts" title="Forecasts">
        <ForecastChanges brief={b} forecastsById={forecastsById} index={index} />
      </Section>

      <Section id="taiwan" title="Impact on Taiwan">
        <div className={`text-sm ${b.taiwan === TAIWAN_NO_NEWS ? "text-muted" : ""}`}>
          {paragraphs(b.taiwan).map((p, i) => <p key={i} className="mt-2 first:mt-0">{p}</p>)}
        </div>
      </Section>

      {b.weekly_outlook ? (
        <Section id="weekly" title="Weekly outlook">
          <WeeklyOutlookView outlook={b.weekly_outlook} assumptionsById={assumptionsById} />
        </Section>
      ) : null}

      <Section id="next" title="Next 72 hours">
        <Next72h events={b.next_72h} />
      </Section>

      <Section id="metrics" title="Metrics">
        <MetricsTable metrics={b.metrics} index={index} />
      </Section>

      <Section id="sources" title={`Sources (${b.sources.length} from ${b.computed.source_category_count} categories)`}>
        <SourceList sources={b.sources} archive={archive} />
      </Section>

      <nav className="mt-10 flex justify-between gap-4 border-t border-line pt-4 text-sm" aria-label="Other briefs">
        {prevDate ? <Link href={`/brief/${prevDate}`}>← {longDate(prevDate)}</Link> : <span />}
        {nextDate ? <Link href={`/brief/${nextDate}`}>{longDate(nextDate)} →</Link> : <span />}
      </nav>
    </article>
  );
}
