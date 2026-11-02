import type { DraftBrief } from "../../lib/schema/draft-brief";
import type { State } from "../../lib/schema/state";
import { countryName, PATHWAY_SHORT, termLabel } from "../../lib/format";
import { RUNGS } from "../../lib/vocab";

// The run summary (SPEC §7.7). There are no alerts: every run ends with this short Markdown, which the
// scheduled task in the Claude app posts as the morning update. It holds only the brief's own text
// and run facts, never tokens or environment values. At most 15 lines.

export interface RunFacts {
  started: string;   // ISO
  finished: string;  // ISO
  attempts: number;
  repairs: number;
}

export type SummaryInput =
  | { kind: "published" | "dry_run"; date: string; brief: DraftBrief; state: State; liveUrl: string | null; reviewBranch?: string; words: number; draftPath?: string; facts: RunFacts }
  | { kind: "failed"; date: string; code: string; what: string; errors: { code: string; message: string }[]; nextStep: string; facts: RunFacts | null }
  | { kind: "skipped"; date: string; reason: string };

const hhmm = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(11, 16);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Up to three short lines on what moved: the ladder, country scores, new incidents, indicators. */
export function changes(brief: DraftBrief, state: State): string[] {
  const out: string[] = [];
  const l = brief.board.ladder;
  if (l.current_rung !== l.previous_rung) out.push(`ladder ${l.previous_rung} → ${l.current_rung}`);
  const moved = brief.board.countries.filter((c) => c.previous_score !== null && c.score !== c.previous_score);
  if (moved.length) out.push(moved.map((c) => `${countryName(c.country)} ${c.previous_score} → ${c.score}`).join(", "));
  const before = new Map(state.pathways.map((p) => [p.pathway, p.serious_odds.probability]));
  const odds = brief.board.pathways.filter((p) => p.trend !== "flat");
  if (odds.length) out.push(odds.map((p) => `${PATHWAY_SHORT[p.pathway]} ${before.get(p.pathway)}% → ${p.serious_odds.probability}%`).join(", "));
  if (brief.incidents_new.length) {
    out.push(`${brief.incidents_new.length} new incident${brief.incidents_new.length === 1 ? "" : "s"}: ${brief.incidents_new.map((i) => `${countryName(i.location_country)} (rung ${i.rung})`).join(", ")}`);
  }
  if (brief.indicator_changes.length) out.push(`indicators: ${brief.indicator_changes.map((c) => `${c.id.replace(/^ind-/, "")} → ${c.to}`).join(", ")}`);
  return out.slice(0, 3);
}

export function renderSummary(s: SummaryInput): string {
  if (s.kind === "skipped") return `**EuropeTracker ${s.date} — skipped.** ${s.reason}\n`;

  if (s.kind === "failed") {
    const lines = [
      `**EuropeTracker ${s.date} — failed** (${s.code})`,
      `What happened: ${oneLine(s.what)}`,
    ];
    if (s.errors.length) {
      lines.push("First errors:");
      for (const e of s.errors.slice(0, 5)) lines.push(`- ${e.code}: ${oneLine(e.message).slice(0, 200)}`);
    }
    lines.push(`Draft and logs: needs-review/${s.date}/`);
    lines.push(`Next step: ${s.nextStep}`);
    if (s.facts) lines.push(`Run: started ${hhmm(s.facts.started)}, ended ${hhmm(s.facts.finished)} · attempts ${s.facts.attempts}, repairs ${s.facts.repairs}`);
    return `${lines.join("\n")}\n`;
  }

  const b = s.brief;
  const l = b.board.ladder;
  const next = l.next_rung_odds ? ` · next-rung odds: ${termLabel(l.next_rung_odds.term)} (${l.next_rung_odds.probability}%)` : "";
  const where = s.kind === "dry_run" ? `draft at ${s.draftPath}`
    : s.reviewBranch ? `pushed ${s.reviewBranch} for review`
    : s.liveUrl ? `live at ${s.liveUrl}` : "committed, not yet live";
  const cats = new Set(b.sources.map((x) => x.category)).size;
  const moved = changes(b, s.state);
  const lines = [
    `**EuropeTracker ${s.date} — ${s.kind === "dry_run" ? "dry run" : "published"}**`,
    `Rung ${l.current_rung} (${RUNGS[l.current_rung]!.name})${next} · ${where}`,
    `Bottom line: ${oneLine(b.bottom_line)}`,
    `Changes: ${moved.length ? moved.join("; ") : "none on the board"}`,
    `Run: started ${hhmm(s.facts.started)}, finished ${hhmm(s.facts.finished)} · attempts ${s.facts.attempts}, repairs ${s.facts.repairs} · ${b.sources.length} sources from ${cats} categories · ${s.words} words`,
  ];
  return `${lines.join("\n")}\n`;
}
