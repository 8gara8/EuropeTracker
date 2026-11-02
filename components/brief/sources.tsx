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
    <span className="whitespace-nowrap text-xs">
      {nums.map(({ id, n }) => (
        <a key={id} href={`#src-${id}`} className="ml-0.5 align-super" aria-label={`Source ${n}`}>[{n}]</a>
      ))}
    </span>
  );
}

function published(at: string | null): string | null {
  return at ? shortDate(at.slice(0, 10)) : null;
}

export function SourceList({ sources, archive }: { sources: Source[]; archive: Record<string, string> }) {
  return (
    <ol className="space-y-2 text-sm">
      {sources.map((s, i) => {
        const snapshot = archive[normalizeUrl(s.url)];
        return (
          <li key={s.id} id={`src-${s.id}`} className="flex gap-2">
            <span className="tabular w-6 shrink-0 text-right text-muted">{i + 1}.</span>
            <span className="min-w-0">
              <span className="font-semibold">{s.outlet}</span>{" "}
              <a href={s.url} rel="noopener noreferrer" className="break-words">{s.title}</a>
              <span className="block text-xs text-muted">
                {sourceCategoryLabel(s.category)} · {s.language}
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
    <span className="text-xs text-muted">
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
