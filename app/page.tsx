import type { Metadata } from "next";
import { BriefView } from "@/components/brief/BriefView";
import { briefPropsFor } from "@/components/brief/props";
import { Empty, PageHeader } from "@/components/layout/chrome";
import { loadContent } from "@/lib/content";
import { SITE_NAME } from "@/lib/site";

export function generateMetadata(): Metadata {
  const latest = loadContent().briefs.at(-1);
  if (!latest) return {};
  return {
    description: latest.bottom_line,
    openGraph: { title: `${SITE_NAME}: ${latest.title}`, description: latest.bottom_line, type: "article" },
  };
}

export default function TodayPage() {
  const content = loadContent();
  const latest = content.briefs.at(-1);
  if (!latest) {
    return (
      <>
        <PageHeader title="Today" />
        <Empty>The first brief arrives at about 06:15 Taipei.</Empty>
      </>
    );
  }
  return <BriefView {...briefPropsFor(content, latest.date)!} />;
}
