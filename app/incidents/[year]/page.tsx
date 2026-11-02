import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IncidentExplorer } from "@/components/incidents/IncidentExplorer";
import { PageHeader } from "@/components/layout/chrome";
import { loadContent } from "@/lib/content";

export const dynamicParams = false;

const years = () => [...new Set(loadContent().incidents.map((i) => i.date.slice(0, 4)))].sort();

export function generateStaticParams() {
  return years().map((year) => ({ year }));
}

type Props = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `Incidents in ${year}` };
}

export default async function IncidentYearPage({ params }: Props) {
  const { year } = await params;
  const incidents = loadContent().incidents.filter((i) => i.date.startsWith(`${year}-`));
  if (!incidents.length) notFound();
  return (
    <>
      <PageHeader title={`Incidents in ${year}`}>
        <Link href="/incidents">All incidents</Link> · {years().filter((y) => y !== year).map((y, i) => (
          <span key={y}>{i ? " · " : ""}<Link href={`/incidents/${y}`}>{y}</Link></span>
        ))}
      </PageHeader>
      <IncidentExplorer incidents={incidents} />
    </>
  );
}
