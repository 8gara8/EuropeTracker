import type { EvidenceSource, Source } from "@/lib/schema/common";
import { shortDate, sourceCategoryLabel } from "@/lib/format";
import { normalizeUrl } from "@/lib/urls";

/** Source id → its number in the brief's source list. */
export type SourceIndex = Record<string, number>;

export function sourceIndex(sources: Source[]): SourceIndex {
  return Object.fromEntries(sources.map((s, i) => [s.id, i + 1]));
}

/** Bracketed links to the numbered source list: [1][4]. */
export function SourceRefs({ ids, index }: { ids: string[]; index: SourceIndex }) {
  const nums = [...new Set(ids)].filter((id) => index[id]).map((id) => ({ id, n: index[id]! }));
  if (!nums.length) return null;
  return (
    <span className="whitespace-nowrap font-mono text-[10px]">
      {nums.map(({ id, n }) => (
        <a key={id} href={`#src-${id}`} className="ml-0.5 align-super text-accent no-underline hover:underline" aria-label={`Source ${n}`}>[{n}]</a>
      ))}
    </span>
  );
}

function published(at: string | null): string | null {
  return at ? shortDate(at.slice(0, 10)) : null;
}

export function SourceList({ sources, archive }: { sources: Source[]; archive: Record<string, string> }) {
  return (
    <ol className="gap-10 md:columns-2">
      {sources.map((s, i) => {
        const snapshot = archive[normalizeUrl(s.url)];
        return (
          <li key={s.id} id={`src-${s.id}`} className="flex break-inside-avoid gap-2.5 border-b border-dotted border-line py-2 text-[13px]">
            <span className="tabular shrink-0 pt-px text-[11px] text-muted">[{String(i + 1).padStart(2, "0")}]</span>
            <span className="min-w-0">
              <span className="font-semibold text-fg">{s.outlet}</span>{" "}
              <a href={s.url} rel="noopener noreferrer" className="break-words text-soft">{s.title}</a>
              <span className="kicker mt-0.5 block normal-case tracking-[0.06em]">
                ↳ {sourceCategoryLabel(s.category)} · {s.language}
                {published(s.published_at) ? ` · ${published(s.published_at)}` : ""}
                {snapshot ? <> · <a href={snapshot} rel="noopener noreferrer">archived</a></> : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The sources stored on an incident, strike or update, as a compact line of outlet links. */
export function EvidenceLinks({ sources }: { sources: EvidenceSource[] }) {
  if (!sources.length) return null;
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
      Sources:{" "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i ? " · " : ""}
          <a href={s.url} rel="noopener noreferrer" title={s.title}>{s.outlet}</a>
        </span>
      ))}
    </span>
  );
}
