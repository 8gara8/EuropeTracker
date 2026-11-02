import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader } from "@/components/layout/chrome";
import { ProbabilityBadge, RungBadge, Tag } from "@/components/ui/badges";
import { loadContent } from "@/lib/content";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  const briefs = [...loadContent().briefs].reverse();
  return (
    <>
      <PageHeader title="Archive">{briefs.length} brief{briefs.length === 1 ? "" : "s"}, newest first.</PageHeader>
      {briefs.length === 0 ? (
        <Empty>No briefs yet. The first one arrives at about 06:15 Taipei.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {briefs.map((b) => (
            <li key={b.date} className="py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="tabular text-muted">{shortDate(b.date)}</span>
                <RungBadge rung={b.board.ladder.current_rung} />
                {b.board.ladder.next_rung_odds ? <ProbabilityBadge estimate={b.board.ladder.next_rung_odds} /> : null}
                {b.quiet_day ? <Tag>quiet day</Tag> : null}
                {b.weekly ? <Tag>weekly</Tag> : null}
              </div>
              <Link href={`/brief/${b.date}`} className="display mt-1 block text-[19px] leading-snug no-underline hover:underline">{b.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
