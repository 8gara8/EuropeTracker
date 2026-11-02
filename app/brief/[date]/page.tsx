import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefView } from "@/components/brief/BriefView";
import { briefPropsFor } from "@/components/brief/props";
import { loadContent } from "@/lib/content";
import { longDate } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadContent().briefs.map((b) => ({ date: b.date }));
}

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const brief = loadContent().briefs.find((b) => b.date === date);
  if (!brief) return {};
  return {
    title: `${longDate(date)}: ${brief.title}`,
    description: brief.bottom_line,
    openGraph: { title: brief.title, description: brief.bottom_line, type: "article" },
  };
}

export default async function BriefPage({ params }: Props) {
  const { date } = await params;
  const props = briefPropsFor(loadContent(), date);
  if (!props) notFound();
  return <BriefView {...props} />;
}
