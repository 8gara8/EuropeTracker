import type { Metadata } from "next";
import Link from "next/link";
import { MonthlyBars } from "@/components/charts";
import { Empty, PageHeader, Section } from "@/components/layout/chrome";
import { StrikeTable } from "@/components/strikes/StrikeTable";
import { loadContent } from "@/lib/content";
import { addDays, monthOf, monthsBetween } from "@/lib/dates";
import { shortDate } from "@/lib/format";
import { asOfDate } from "@/lib/site-data";
import { VERIFICATION } from "@/lib/vocab";

export const metadata: Metadata = { title: "Deep-strike log" };

export default function StrikesPage() {
  const content = loadContent();
  const asOf = asOfDate(content);
  const from = addDays(asOf, -179);
  const recent = content.strikes.filter((s) => s.date >= from && s.date <= asOf);
  const strikes = content.strikes;

  const months = strikes.length
    ? monthsBetween(strikes[0]!.date, asOf).map((month) => ({ month, counts: { strikes: strikes.filter((s) => monthOf(s.date) === month).length } }))
    : [];
  const mix = ([1, 2, 3, 4, 5] as const).map((level) => ({ level, n: recent.filter((s) => s.verification === level).length }));
  const maxMix = Math.max(...mix.map((m) => m.n), 1);

  return (
    <>
      <PageHeader title="Deep-strike log">
        Ukraine&apos;s strikes into Russia, each graded on a five-level <Link href="/methodology#ladders">verification ladder</Link>.
      </PageHeader>

      {strikes.length === 0 ? <Empty>The strike log is empty until the seed data is loaded.</Empty> : (
        <>
          <Section title="Strikes per month">
            <MonthlyBars months={months} series={[{ key: "strikes", label: "Strikes", color: "var(--accent)" }]} ariaLabel="Ukrainian deep strikes logged per month" />
          </Section>

          <Section title="How well verified (last 180 days)">
            <ul className="space-y-1 text-sm">
              {mix.map((m) => (
                <li key={m.level} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2">
                  <span>{m.level}. {VERIFICATION[m.level].label}</span>
                  <span className="h-3 rounded-r" style={{ width: `${(m.n / maxMix) * 100}%`, minWidth: m.n ? 4 : 0, background: "var(--accent)" }} aria-hidden="true" />
                  <span className="tabular text-right">{m.n}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`Strikes since ${shortDate(from)} (${recent.length})`}>
            {recent.length ? <StrikeTable strikes={recent} /> : <Empty>No strikes logged in the last 180 days.</Empty>}
          </Section>
        </>
      )}
    </>
  );
}
