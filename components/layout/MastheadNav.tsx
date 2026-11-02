"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The tab bar under the masthead. The active tab inverts (ink background), as on ME Tracker.

const TABS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/", label: "Today", match: (p) => p === "/" || p.startsWith("/brief/") },
  { href: "/board", label: "Board", match: (p) => p.startsWith("/board") },
  { href: "/incidents", label: "Incidents", match: (p) => p.startsWith("/incidents") },
  { href: "/strikes", label: "Strikes", match: (p) => p.startsWith("/strikes") },
  { href: "/forecasts", label: "Forecasts", match: (p) => p.startsWith("/forecasts") },
  { href: "/indicators", label: "Indicators", match: (p) => p.startsWith("/indicators") },
  { href: "/archive", label: "Archive", match: (p) => p.startsWith("/archive") },
  { href: "/methodology", label: "Method", match: (p) => p.startsWith("/methodology") },
];

export function MastheadNav({ meta }: { meta: string | null }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className="flex items-stretch overflow-x-auto border-b border-line font-sans text-[11px] font-semibold uppercase tracking-[0.16em] [scrollbar-width:none] md:text-[12px] [&::-webkit-scrollbar]:hidden">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-r border-line px-3 py-[10px] no-underline md:px-4 ${active ? "bg-fg text-bg hover:text-bg" : "text-fg hover:bg-deep hover:text-fg"}`}
          >
            {t.label}
          </Link>
        );
      })}
      {meta ? <span className="tabular ml-auto hidden items-center whitespace-nowrap px-2 text-[11px] font-normal tracking-[0.08em] text-muted lg:flex">{meta}</span> : null}
    </nav>
  );
}
