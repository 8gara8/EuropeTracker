import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/board", label: "Board" },
  { href: "/incidents", label: "Incidents" },
  { href: "/strikes", label: "Strikes" },
  { href: "/indicators", label: "Indicators" },
  { href: "/forecasts", label: "Forecasts" },
  { href: "/archive", label: "Archive" },
  { href: "/methodology", label: "Method" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-baseline gap-4 px-4 pt-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-fg hover:no-underline">
          Europe<span className="text-accent">Tracker</span>
        </Link>
        <span className="hidden truncate text-xs text-muted sm:inline">Spillover risk from the Russia-Ukraine war</span>
      </div>
      <nav aria-label="Main" className="mx-auto max-w-3xl overflow-x-auto px-4">
        <ul className="flex gap-4 whitespace-nowrap py-2 text-sm">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="text-muted hover:text-fg">{n.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-x-4 gap-y-1 px-4 py-6 text-sm text-muted">
        <span>{SITE_NAME} · updated daily at about 06:15 Taipei</span>
        <Link href="/feed.xml">RSS</Link>
        <Link href="/methodology">Methodology</Link>
        <Link href="/methodology#corrections">Corrections</Link>
      </div>
    </footer>
  );
}

export function SampleBanner() {
  return (
    <div role="note" className="px-4 py-2 text-center text-sm font-semibold" style={{ background: "var(--sample-bg)", color: "var(--sample-fg)" }}>
      Sample data for layout testing — not real reporting
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

/** A titled section of a page or brief. */
export function Section({ id, title, children, note }: { id?: string; title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section id={id} className="mt-8">
      <h2 className="mb-3 border-b border-line pb-1 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      {note ? <p className="-mt-1 mb-3 text-xs text-muted">{note}</p> : null}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
