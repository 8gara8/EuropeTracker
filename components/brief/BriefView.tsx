import Link from "next/link";
import type { Brief } from "@/lib/schema/brief";
import type { Forecast } from "@/lib/schema/forecast";
import type { Incident } from "@/lib/schema/incident";
import type { Indicator } from "@/lib/schema/state";
import type { Strike } from "@/lib/schema/strike";
import { longDate, paragraphs, windowLabel } from "@/lib/format";
import { PATHWAYS, TAIWAN_NO_NEWS, type CategoryId } from "@/lib/vocab";
import { Dateline, Section } from "@/components/layout/chrome";
import { CategoryNotes, DevelopmentRow, ForecastChanges, Judgement, MetricsTable, Next72h, WeeklyOutlookView } from "./analysis";
import { EasternFlank, PathwayBars, RiskMatrix, SpilloverGauge } from "./overview";
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
  archive: Record<string, string>;   // normalized URL → snapshot URL
  prevDate: string | null;
  nextDate: string | null;
}

/** Categories about Europe itself (the pathways and allied resolve); the rest are the war that drives them. */
const EUROPE = new Set<CategoryId>([...PATHWAYS, "resolve"]);

/** The whole brief, in the order SPEC §6 sets, laid out in the paper design. */
export function BriefView(props: BriefViewProps) {
  const { brief: b, incidentsById, strikesById, forecastsById, indicatorsById, archive, prevDate, nextDate } = props;
  const index = sourceIndex(b.sources);
  const hasIndicators = b.indicator_changes.length + b.indicators_new.length > 0;
  const europe = b.developments.filter((d) => EUROPE.has(d.category));
  const war = b.developments.filter((d) => !EUROPE.has(d.category));
  const minutes = Math.max(1, Math.round(b.computed.word_count / 250));
  let n = 0;
  const num = () => ++n;

  return (
    <article>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
        <header className="flex flex-col gap-4">
          <Dateline>Morning brief · {longDate(b.date)}{b.weekly ? " · weekly outlook inside" : ""}{b.quiet_day ? " · quiet day" : ""}</Dateline>
          <h1 className="brief-h1 max-w-[26ch]">{b.title}</h1>
          <p className="prose-serif dropcap text-[18px] md:text-[19px]">{b.bottom_line} <SourceRefs ids={b.bottom_line_source_ids} index={index} /></p>
          <p className="kicker">Covers {windowLabel(b.window)} · {b.computed.word_count.toLocaleString("en-GB")} words · {b.sources.length} sources from {b.computed.source_category_count} categories · {minutes} min read</p>
        </header>
        <SpilloverGauge current={b.board.ladder.current_rung} previous={b.board.ladder.previous_rung} nextOdds={b.board.ladder.next_rung_odds} rationale={b.board.ladder.rationale} pathways={b.board.pathways} />
      </div>

      <Section id="board" number={num()} title="Where the risk sits" right="30-day odds of a serious incident × how bad it would be">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-7">
          <EasternFlank countries={b.board.countries} index={index} />
          <RiskMatrix pathways={b.board.pathways} />
        </div>
        <div className="mt-5 grid gap-x-8 gap-y-2 border-t border-line pt-4 md:grid-cols-[170px_1fr]">
          <p className="kicker text-fg">Why rung {b.board.ladder.current_rung}</p>
          <p className="prose-serif text-[16px]">{b.board.ladder.rationale}</p>
        </div>
        <h3 className="kicker mt-6 mb-1 text-fg">The seven pathways</h3>
        <PathwayBars pathways={b.board.pathways} computed={b.computed.pathways} index={index} />
      </Section>

      {b.developments.length ? (
        <Section id="developments" number={num()} title="What happened" right={`${b.developments.length} developments · Europe first, then the war`}>
          {europe.length ? (
            <>
              <h3 className="kicker mb-2 text-accent">In Europe</h3>
              <div className="border-t border-line">
                {europe.map((d, i) => <DevelopmentRow key={d.id} development={d} n={i + 1} index={index} europe />)}
              </div>
            </>
          ) : null}
          {war.length ? (
            <>
              <h3 className={`kicker mb-2 text-fg ${europe.length ? "mt-6" : ""}`}>The war</h3>
              <div className="border-t border-line">
                {war.map((d, i) => <DevelopmentRow key={d.id} development={d} n={europe.length + i + 1} index={index} europe={false} />)}
              </div>
            </>
          ) : null}
        </Section>
      ) : null}

      {b.incidents_new.length || b.incident_updates.length ? (
        <Section id="incidents" number={num()} title="New incidents in Europe" right={`${b.incidents_new.length} new · ${b.incident_updates.length} updated`}>
          {b.incidents_new.length ? <ul className="border-t border-line">{b.incidents_new.map((x) => <IncidentRow key={x.id} incident={x} />)}</ul> : null}
          <IncidentUpdates updates={b.incident_updates} incidentsById={incidentsById} />
        </Section>
      ) : null}

      {b.strikes_new.length || b.strike_updates.length ? (
        <Section id="strikes" number={num()} title="Deep strikes" right={`${b.strikes_new.length} new · ${b.strike_updates.length} updated`}>
          {b.strikes_new.length ? <ul className="border-t border-line">{b.strikes_new.map((s) => <StrikeRow key={s.id} strike={s} />)}</ul> : null}
          <StrikeUpdates updates={b.strike_updates} strikesById={strikesById} />
        </Section>
      ) : null}

      <div className="grid items-start gap-x-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Section id="judgement" number={num()} title="Judgement">
          <Judgement judgement={b.judgement} />
        </Section>
        <Section id="taiwan" number={num()} title="Impact on Taiwan">
          <div className="flex flex-col gap-3 bg-fg px-[22px] py-5 text-bg">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--p-unlikely)" }}>What today means for Taiwan</span>
            <div className={`font-display text-[17px] leading-[1.55] ${b.taiwan === TAIWAN_NO_NEWS ? "italic opacity-80" : ""}`}>
              {paragraphs(b.taiwan).map((p, i) => <p key={i} className="mt-2.5 first:mt-0">{p}</p>)}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--rule-soft)" }}>US supply · China&apos;s calculus · military lessons · energy · chips</span>
          </div>
        </Section>
      </div>

      <Section id="categories" number={num()} title="All twelve categories" right={`${b.categories.filter((c) => c.status === "material").length} with material change`}>
        <CategoryNotes notes={b.categories} index={index} />
      </Section>

      {hasIndicators ? (
        <Section id="indicators" number={num()} title="Warning indicators that moved">
          <IndicatorChanges changes={b.indicator_changes} added={b.indicators_new} indicatorsById={indicatorsById} index={index} />
        </Section>
      ) : null}

      <Section id="forecasts" number={num()} title="Forecasts">
        <ForecastChanges brief={b} forecastsById={forecastsById} index={index} />
      </Section>

      {b.weekly_outlook ? (
        <Section id="weekly" number={num()} title="Weekly outlook">
          <WeeklyOutlookView outlook={b.weekly_outlook} />
        </Section>
      ) : null}

      <div className="grid items-start gap-x-10 lg:grid-cols-2">
        <Section id="next" number={num()} title="Next 72 hours">
          <Next72h events={b.next_72h} />
        </Section>
        <Section id="metrics" number={num()} title="Metrics">
          <MetricsTable metrics={b.metrics} index={index} />
        </Section>
      </div>

      <Section id="sources" number={num()} title="Sources" right={`${b.sources.length} from ${b.computed.source_category_count} categories`}>
        <SourceList sources={b.sources} archive={archive} />
      </Section>

      <nav className="mt-10 flex justify-between gap-4 border-t border-rule pt-3 font-mono text-[11px] uppercase tracking-[0.12em]" aria-label="Other briefs">
        {prevDate ? <Link href={`/brief/${prevDate}`}>← {longDate(prevDate)}</Link> : <span />}
        {nextDate ? <Link href={`/brief/${nextDate}`}>{longDate(nextDate)} →</Link> : <span />}
      </nav>
    </article>
  );
}
