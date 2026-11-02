import Link from "next/link";
import type { ReactNode } from "react";
import { loadContent } from "@/lib/content";
import { shortDate } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";
import { RUNGS } from "@/lib/vocab";
import { MastheadNav } from "./MastheadNav";

// The page frame in ME Tracker's "paper" design: masthead with wordmark and stamp, tab bar, section
// rules with mono labels, and a mono footer.

/** A rubber-stamp label, rotated a little. */
export function Stamp({ text, angle = -3 }: { text: string; angle?: number }) {
  return (
    <span
      className="inline-block border-2 border-accent px-[10px] py-[4px] font-mono text-[11px] font-bold uppercase tracking-[0.16em] whitespace-nowrap text-accent opacity-90"
      style={{ transform: `rotate(${angle}deg)` }}
    >
      {text}
    </span>
  );
}

export function Masthead() {
  const { briefs } = loadContent();
  const latest = briefs.at(-1);
  const meta = latest ? `${shortDate(latest.date)} · Brief ${String(briefs.length).padStart(3, "0")} · Rung ${latest.board.ladder.current_rung} of ${RUNGS.length - 1}` : null;
  return (
    <header className="mb-2">
      <div className="mb-[10px] flex flex-wrap items-center gap-x-5 gap-y-2 border-b-[3px] border-double border-rule pb-[10px] md:items-baseline">
        <Link href="/" className="flex-1 whitespace-nowrap font-display text-[23px] font-semibold leading-none tracking-[-0.02em] text-fg no-underline hover:text-fg md:flex-none md:text-[28px]">
          <span className="italic">Europe</span> Tracker
        </Link>
        <span className="hidden font-display text-[18px] text-muted md:inline">The morning spillover brief</span>
        <div className="flex items-center gap-3 md:ml-auto">
          <span className="kicker hidden whitespace-nowrap md:inline">Daily 06:15 Taipei · @8gara8</span>
          <Stamp text="Unclassified · OSINT" />
        </div>
      </div>
      <MastheadNav meta={meta} />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-14 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>© 2026 {SITE_NAME} · @8gara8</span>
        <span aria-hidden="true">·</span>
        <span>Updated daily at about 06:15 Taipei</span>
        <span aria-hidden="true">·</span>
        <span>Git audit trail: content/briefs/</span>
        <span className="flex gap-4 md:ml-auto">
          <Link href="/feed.xml">RSS</Link>
          <Link href="/methodology">Methodology</Link>
          <Link href="/methodology#corrections">Corrections</Link>
        </span>
      </div>
    </footer>
  );
}

export function SampleBanner() {
  return (
    <div role="note" className="px-4 py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ background: "var(--sample-bg)", color: "var(--sample-fg)" }}>
      Sample data for layout testing — not real reporting
    </div>
  );
}

/** The kicker line above a page or brief title: a red bar and mono text. */
export function Dateline({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
      <span aria-hidden="true">▮ </span>{children}
    </p>
  );
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <Dateline>{kicker ?? SITE_NAME}</Dateline>
      <h1 className="brief-h1 mt-2 max-w-[24ch]">{title}</h1>
      {children ? <div className="mt-3 max-w-[72ch] text-[14px] text-soft">{children}</div> : null}
    </div>
  );
}

/** A section with ME Tracker's rule: a 1px ink line, an optional §NN number, the label and right-side meta. */
export function Section({ id, title, children, note, number, right }: {
  id?: string; title: string; children: ReactNode; note?: ReactNode; number?: number; right?: ReactNode;
}) {
  return (
    <section id={id} className="mt-9">
      <h2 className="mb-4 flex items-baseline gap-3 border-t border-rule pt-2">
        {number !== undefined ? <span className="font-mono text-[10px] tracking-[0.14em] text-muted">§{String(number).padStart(2, "0")}</span> : null}
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-fg">{title}</span>
        {right ? <span className="kicker ml-auto text-right">{right}</span> : null}
      </h2>
      {note ? <p className="-mt-2 mb-4 max-w-[72ch] text-[13px] text-muted">{note}</p> : null}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-line bg-panel px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{children}</p>;
}
