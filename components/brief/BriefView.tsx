import Link from "next/link";
import type { Brief } from "@/lib/schema/brief";
import type { Forecast } from "@/lib/schema/forecast";
import type { Incident } from "@/lib/schema/incident";
import type { Indicator } from "@/lib/schema/state";
import type { Strike } from "@/lib/schema/strike";
import { countryName, longDate, paragraphs, PATHWAY_SHORT, windowLabel } from "@/lib/format";
import { COUNTRY_SCORES, PROBABILITY_TERMS, RUNGS, TAIWAN_NO_NEWS } from "@/lib/vocab";
import { Dateline, Section } from "@/components/layout/chrome";
import { Chip, TONE_COLOR, rungTone, scoreTone, termTone, type Tone } from "@/components/ui/badges";
import { CategoryNotes, DevelopmentRow, ForecastChanges, Judgement, MetricsTable, Next72h, WeeklyOutlookView } from "./analysis";
import { CountryTiles, LadderGauge, PathwayDials } from "./board";
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

interface Tile { label: string; value: string; sub: string; tone: Tone; color?: string }

/** The four headline tiles under the title (ME Tracker's headline indicators bar). */
function HeadlineBar({ brief: b }: { brief: Brief }) {
  const { current_rung: rung, next_rung_odds: next } = b.board.ladder;
  const top = [...b.board.pathways].sort((x, y) => y.serious_odds.probability - x.serious_odds.probability)[0]!;
  const country = [...b.board.countries].sort((x, y) => y.score - x.score)[0]!;
  const tiles: Tile[] = [
    { label: "Spillover ladder", value: `Rung ${rung}`, sub: RUNGS[rung]!.name, tone: rungTone(rung), color: `var(--rung-${rung})` },
    next
      ? { label: "Next rung · 30 days", value: `${next.probability}%`, sub: PROBABILITY_TERMS[next.term].label, tone: termTone(next.term) }
      : { label: "Next rung · 30 days", value: "—", sub: "Top of the ladder", tone: "neutral" },
    { label: "Highest pathway risk", value: PATHWAY_SHORT[top.pathway], sub: `${PROBABILITY_TERMS[top.serious_odds.term].label} · ${top.serious_odds.probability}%`, tone: termTone(top.serious_odds.term) },
    { label: "Highest frontline score", value: countryName(country.country), sub: `${country.score} · ${COUNTRY_SCORES[country.score].label}`, tone: scoreTone(country.score), color: `var(--score-${country.score})` },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 border border-rule bg-panel md:grid-cols-4" style={{ borderLeft: "3px solid var(--accent)" }}>
      {tiles.map((t, i) => {
        const c = t.color ?? TONE_COLOR[t.tone];
        return (
          <div key={t.label} className={`flex min-w-0 flex-col gap-1.5 px-[18px] py-[14px] ${i % 2 === 0 ? "border-r border-line" : "md:border-r md:border-line"} ${i < 2 ? "border-b border-line md:border-b-0" : ""} ${i === 3 ? "md:border-r-0" : ""}`}>
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              <Chip color={c} /><span className="leading-tight">{t.label}</span>
            </span>
            <span className="display break-words uppercase leading-[1.05]" style={{ fontSize: "clamp(18px, 4.6vw, 28px)", color: t.tone === "neutral" ? "var(--ink)" : c }}>{t.value}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">{t.sub}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The whole brief, in the order SPEC §6 sets, laid out in ME Tracker's paper design. */
export function BriefView(props: BriefViewProps) {
  const { brief: b, incidentsById, strikesById, forecastsById, indicatorsById, archive, prevDate, nextDate } = props;
  const index = sourceIndex(b.sources);
  const hasIndicators = b.indicator_changes.length + b.indicators_new.length > 0;
  let n = 0;
  const num = () => ++n;

  return (
    <article>
      <header>
        <Dateline>Morning brief · {longDate(b.date)}{b.weekly ? " · with weekly outlook" : ""}{b.quiet_day ? " · quiet day" : ""}</Dateline>
        <h1 className="brief-h1 mt-3 max-w-[26ch]">{b.title}</h1>
        <p className="kicker mt-3">Covers {windowLabel(b.window)} · {b.computed.word_count.toLocaleString("en-GB")} words · {b.sources.length} sources from {b.computed.source_category_count} categories</p>
      </header>

      <HeadlineBar brief={b} />

      <div className="mt-6 grid gap-x-8 gap-y-3 border-t border-rule pt-4 md:grid-cols-[170px_1fr]">
        <div>
          <p className="kicker text-fg">Bottom line</p>
          <p className="display mt-2 text-[17px] font-normal italic leading-snug text-soft">Where the risk to Europe stands this morning.</p>
        </div>
        <p className="prose-serif dropcap">{b.bottom_line} <SourceRefs ids={b.bottom_line_source_ids} index={index} /></p>
      </div>

      <Section id="board" number={num()} title="Spillover board" right="30-day odds of a serious incident">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_1fr]">
          <LadderGauge current={b.board.ladder.current_rung} previous={b.board.ladder.previous_rung} nextOdds={b.board.ladder.next_rung_odds} />
          <div>
            <p className="kicker text-fg">Why rung {b.board.ladder.current_rung}</p>
            <p className="prose-serif mt-2 text-[16px]">{b.board.ladder.rationale}</p>
          </div>
        </div>
        <h3 className="kicker mt-7 mb-3 text-fg">Pathways</h3>
        <PathwayDials pathways={b.board.pathways} computed={b.computed.pathways} index={index} />
        <h3 className="kicker mt-7 mb-3 text-fg">Frontline countries</h3>
        <CountryTiles countries={b.board.countries} index={index} />
      </Section>

      {b.developments.length ? (
        <Section id="developments" number={num()} title="Key developments" right={`${b.developments.length} items`}>
          <div className="border-t border-line">
            {b.developments.map((d, i) => <DevelopmentRow key={d.id} development={d} n={i + 1} index={index} />)}
          </div>
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

      <Section id="judgement" number={num()} title="Judgement">
        <Judgement judgement={b.judgement} />
      </Section>

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

      <Section id="taiwan" number={num()} title="Impact on Taiwan">
        <div className="max-w-[900px] border border-line bg-panel px-5 py-4" style={{ borderLeft: "3px solid var(--accent)" }}>
          <div className={`prose-serif text-[16px] ${b.taiwan === TAIWAN_NO_NEWS ? "text-muted italic" : ""}`}>
            {paragraphs(b.taiwan).map((p, i) => <p key={i} className="mt-2 first:mt-0">{p}</p>)}
          </div>
        </div>
      </Section>

      {b.weekly_outlook ? (
        <Section id="weekly" number={num()} title="Weekly outlook">
          <WeeklyOutlookView outlook={b.weekly_outlook} />
        </Section>
      ) : null}

      <Section id="next" number={num()} title="Next 72 hours">
        <Next72h events={b.next_72h} />
      </Section>

      <Section id="metrics" number={num()} title="Metrics">
        <MetricsTable metrics={b.metrics} index={index} />
      </Section>

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
