import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { PageHeader, Section } from "@/components/layout/chrome";
import { ProbabilityBadge, RungBadge, ScoreBadge } from "@/components/ui/badges";
import { loadContent } from "@/lib/content";
import { shortDate } from "@/lib/format";
import { parseBlocks, section } from "@/lib/markdown";
import {
  ATTRIBUTION, CATEGORIES, CATEGORY_INFO, COUNTRY_SCORES, PATHWAYS, PATHWAY_INFO, PROBABILITY_TERM_IDS,
  PROBABILITY_TERMS, RUNGS, SOURCE_CATEGORIES, SOURCE_CATEGORY_IDS, VERIFICATION, type Score,
} from "@/lib/vocab";

export const metadata: Metadata = { title: "Methodology" };

// Definitions render from lib/vocab.ts; method prose renders from routine/STYLE.md, the rules the
// research agent follows, so neither is copied here.
function style(n: number) {
  const md = fs.readFileSync(path.join(process.cwd(), "routine/STYLE.md"), "utf8");
  const s = section(md, n);
  return s ? { title: s.title, blocks: parseBlocks(s.body) } : null;
}

function StyleSection({ n, id, skipTables = false }: { n: number; id?: string; skipTables?: boolean }) {
  const s = style(n);
  if (!s) return null;
  return <Section id={id} title={s.title}><Markdown blocks={s.blocks} skipTables={skipTables} /></Section>;
}

const th = "border-b border-rule py-1.5 pr-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted";
const td = "border-b border-line py-1.5 pr-3 align-top";

export default function MethodologyPage() {
  const { corrections } = loadContent();
  const groups = ["Drivers", "Pathways", "Brakes"] as const;

  return (
    <>
      <PageHeader title="Methodology">
        How EuropeTracker measures the risk of the Russia-Ukraine war spilling into Europe. Definitions here are the
        ones the validator enforces on every brief.
      </PageHeader>

      <StyleSection n={1} id="question" />

      <Section id="ladder" title="Spillover ladder">
        <p className="mb-2 text-sm">The current rung is the highest rung of any incident logged in the last 30 days. Code computes it; the brief must match.</p>
        <ul className="space-y-2 text-sm">
          {RUNGS.map((r) => (
            <li key={r.rung}><RungBadge rung={r.rung} /> <span className="font-semibold">{r.name}.</span> {r.qualifies}</li>
          ))}
        </ul>
      </Section>

      <Section id="pathways" title="Pathways and serious incidents">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Pathway</th><th className={th}>What counts</th><th className={th}>Serious incident</th></tr></thead>
            <tbody>
              {PATHWAYS.map((p) => (
                <tr key={p}><td className={`${td} font-semibold`}>{PATHWAY_INFO[p].label}</td><td className={td}>{PATHWAY_INFO[p].counts}</td><td className={td}>{PATHWAY_INFO[p].serious}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <StyleSection n={4} id="counting" />

      <Section id="ladders" title="Attribution and verification">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="kicker mb-1 text-fg">Attribution of incidents in Europe</h3>
            <ol className="mt-1 space-y-1 text-sm">
              {([1, 2, 3, 4] as const).map((l) => <li key={l}><span className="font-semibold">{l}. {ATTRIBUTION[l].label}:</span> {ATTRIBUTION[l].means}</li>)}
            </ol>
          </div>
          <div>
            <h3 className="kicker mb-1 text-fg">Verification of Ukraine&apos;s deep strikes</h3>
            <ol className="mt-1 space-y-1 text-sm">
              {([1, 2, 3, 4, 5] as const).map((l) => <li key={l}><span className="font-semibold">{l}. {VERIFICATION[l].label}:</span> {VERIFICATION[l].means}</li>)}
            </ol>
          </div>
        </div>
      </Section>

      <Section id="probability" title="Probability scale">
        <p className="mb-2 text-sm">The UK intelligence yardstick. A number must sit inside its term&apos;s band; the gaps between bands are not allowed. Confidence (low, moderate, high) is stated separately.</p>
        <ul className="flex flex-wrap gap-2">
          {PROBABILITY_TERM_IDS.map((t) => {
            const band = PROBABILITY_TERMS[t];
            return <li key={t}><ProbabilityBadge estimate={{ probability: band.max, term: t, confidence: "moderate" }} /> <span className="tabular text-xs text-muted">{band.min}–{band.max}%</span></li>;
          })}
        </ul>
      </Section>

      <Section id="countries" title="Frontline country scores">
        <p className="mb-2 text-sm">Poland, Lithuania, Latvia, Estonia, Finland, Romania and Moldova are scored daily. Incidents affecting a country in the last 30 days set a floor; a score may sit one above it with a reason, and higher only when an active strategic indicator names the country.</p>
        <ul className="space-y-1.5 text-sm">
          {([1, 2, 3, 4, 5] as Score[]).map((s) => <li key={s}><ScoreBadge score={s} /> {COUNTRY_SCORES[s].anchor}</li>)}
        </ul>
      </Section>

      <Section id="categories" title="Coverage categories">
        {groups.map((g) => (
          <div key={g} className="mt-3 first:mt-0">
            <h3 className="kicker mb-1 text-fg">{g}</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {CATEGORIES.filter((c) => CATEGORY_INFO[c].group === g).map((c) => (
                <li key={c}><span className="font-semibold">{CATEGORY_INFO[c].label}:</span> {CATEGORY_INFO[c].covers}</li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section id="sources" title="Source categories">
        <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {SOURCE_CATEGORY_IDS.map((c) => <li key={c}><span className="tabular text-muted">{SOURCE_CATEGORIES[c].n}.</span> {SOURCE_CATEGORIES[c].label}</li>)}
        </ol>
        <StyleSourceRules />
      </Section>

      <StyleSection n={12} id="forecasting" />
      <StyleSection n={14} id="taiwan" />

      <Section id="corrections" title="Corrections">
        {corrections.length === 0 ? <p className="text-sm text-muted">No corrections so far. Corrections are appended here openly, never silently edited.</p> : (
          <ul className="space-y-2 text-sm">
            {[...corrections].reverse().map((c) => (
              <li key={c.id}><span className="tabular text-muted">{shortDate(c.date)}</span> <span className="font-semibold">{c.target.kind} {c.target.id}:</span> {c.description}</li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function StyleSourceRules() {
  const s = style(10);
  return s ? <div className="mt-3"><Markdown blocks={s.blocks} skipTables /></div> : null;
}
