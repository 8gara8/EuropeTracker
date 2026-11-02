import type { Metadata } from "next";
import Link from "next/link";
import { MonthlyBars } from "@/components/charts";
import { IncidentExplorer } from "@/components/incidents/IncidentExplorer";
import { Empty, PageHeader, Section } from "@/components/layout/chrome";
import { monthlyCounts } from "@/lib/aggregate";
import { loadContent } from "@/lib/content";
import { addDays } from "@/lib/dates";
import { shortDate } from "@/lib/format";
import { asOfDate } from "@/lib/site-data";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsPage() {
  const content = loadContent();
  const asOf = asOfDate(content);
  const from = addDays(asOf, -364);
  const lastYear = content.incidents.filter((i) => i.date >= from && i.date <= asOf);
  const years = [...new Set(content.incidents.map((i) => i.date.slice(0, 4)))].sort().reverse();

  return (
    <>
      <PageHeader title="Incidents in Europe">
        Spillover incidents since February 2022: {content.incidents.length} logged, each graded for attribution.
        Counting rules are on the <Link href="/methodology#counting">methodology page</Link>.
      </PageHeader>

      {content.incidents.length === 0 ? (
        <Empty>The incident database is empty until the seed data is loaded.</Empty>
      ) : (
        <>
          <Section title="Incidents per month, by pathway">
            <MonthlyBars months={monthlyCounts(content.incidents, asOf)} ariaLabel="Incidents per month by pathway since February 2022" />
          </Section>

          <Section title={`Last 365 days (${shortDate(from)} to ${shortDate(asOf)})`}>
            <IncidentExplorer incidents={lastYear} />
          </Section>

          <Section title="By year">
            <ul className="flex flex-wrap gap-3 text-sm">
              {years.map((y) => <li key={y}><Link href={`/incidents/${y}`}>{y}</Link></li>)}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
