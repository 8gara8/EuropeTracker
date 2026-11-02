import { brier, pathwayCounts } from "./aggregate";
import type { Brief } from "./schema/brief";
import type { EvidenceSource } from "./schema/common";
import type { DraftBrief, IncidentUpdate, StrikeUpdate } from "./schema/draft-brief";
import type { Forecast } from "./schema/forecast";
import type { Incident } from "./schema/incident";
import type { ArchiveIndex } from "./schema/misc";
import type { State } from "./schema/state";
import type { Strike } from "./schema/strike";
import { totalWords } from "./rules/words";
import { PATHWAYS } from "./vocab";

// Applying a validated draft to the content (SPEC §7.6 step 3). Pure: publish.ts does the reading,
// validating, writing and git. The validator also uses the record-merging helpers.

/** The record with the update's non-null changes applied. Sources and dates are applyDraft's job. */
export function applyIncidentChanges<T extends Pick<Incident, "attribution" | "rung"> & Partial<Incident>>(
  rec: T,
  u: IncidentUpdate,
): T {
  const c = u.changes;
  return {
    ...rec,
    attribution: c.attribution ?? rec.attribution,
    rung: c.rung ?? rec.rung,
    ...(c.attribution_note !== null && { attribution_note: c.attribution_note }),
    ...(c.serious !== null && { serious: c.serious }),
    ...(c.casualties !== null && { casualties: c.casualties }),
    ...(c.disruption_hours !== null && { disruption_hours: c.disruption_hours }),
    ...(c.summary !== null && { summary: c.summary }),
    ...(c.host_statement !== null && { host_statement: c.host_statement }),
  };
}

export function applyStrikeChanges<T extends Pick<Strike, "verification"> & Partial<Strike>>(rec: T, u: StrikeUpdate): T {
  const c = u.changes;
  return {
    ...rec,
    verification: c.verification ?? rec.verification,
    ...(c.damage !== null && { damage: c.damage }),
    ...(c.effect !== null && { effect: c.effect }),
    ...(c.summary !== null && { summary: c.summary }),
    ...(c.weapon_detail !== null && { weapon_detail: c.weapon_detail }),
    ...(c.western_weapon !== null && { western_weapon: c.western_weapon }),
  };
}

export interface ContentState {
  incidents: Incident[];
  strikes: Strike[];
  state: State;
  forecasts: Forecast[];
  archive: ArchiveIndex["urls"];
}

export interface Applied extends ContentState {
  brief: Brief;
}

const byDateThenId = <T extends { date: string; id: string }>(a: T, b: T) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

function addSources(existing: EvidenceSource[], added: EvidenceSource[]): EvidenceSource[] {
  const seen = new Set(existing.map((s) => s.url));
  return [...existing, ...added.filter((s) => !seen.has(s.url))];
}

/** Applies `draft` (already validated) to the current content and returns the new content and brief. */
export function applyDraft(content: ContentState, draft: DraftBrief, opts: { publishedAt: string; pendingArchive?: ArchiveIndex["urls"] }): Applied {
  const D = draft.date;

  // Incidents and strikes: today's new records (code sets the bookkeeping fields), then the updates.
  const newIncidents: Incident[] = draft.incidents_new.map((x) => ({ ...x, seed: false, added: D, updated: null }));
  const incUpdates = new Map(draft.incident_updates.map((u) => [u.id, u]));
  const incidents = [
    ...content.incidents.map((rec) => {
      const u = incUpdates.get(rec.id);
      return u ? { ...applyIncidentChanges(rec, u), sources: addSources(rec.sources, u.add_sources), updated: D } : rec;
    }),
    ...newIncidents,
  ].sort(byDateThenId);

  const newStrikes: Strike[] = draft.strikes_new.map((x) => ({ ...x, seed: false, added: D, updated: null }));
  const strUpdates = new Map(draft.strike_updates.map((u) => [u.id, u]));
  const strikes = [
    ...content.strikes.map((rec) => {
      const u = strUpdates.get(rec.id);
      return u ? { ...applyStrikeChanges(rec, u), sources: addSources(rec.sources, u.add_sources), updated: D } : rec;
    }),
    ...newStrikes,
  ].sort(byDateThenId);

  // Forecasts: open the new ones, record updates, settle resolutions with their Brier scores.
  const sourceById = new Map(draft.sources.map((s) => [s.id, s]));
  const updates = new Map(draft.forecast_updates.map((u) => [u.id, u]));
  const resolutions = new Map(draft.forecast_resolutions.map((r) => [r.id, r]));
  const forecasts: Forecast[] = [
    ...content.forecasts.map((f): Forecast => {
      let next = f;
      const u = updates.get(f.id);
      if (u) next = { ...next, updates: [...next.updates, { date: D, probability: u.probability, note: u.note }] };
      const r = resolutions.get(f.id);
      if (r) {
        const src = sourceById.get(r.source_id);
        next = {
          ...next,
          status: r.outcome === "yes" ? "resolved_yes" : r.outcome === "no" ? "resolved_no" : "annulled",
          resolved_on: D,
          resolution_note: r.note,
          resolution_source: src ? { title: src.title, outlet: src.outlet, category: src.category, url: src.url, published_at: src.published_at } : null,
        };
        next = { ...next, ...brier(next) };
      }
      return next;
    }),
    ...draft.forecasts_new.map((f): Forecast => ({
      ...f, opened: D, updates: [], status: "open", resolved_on: null, resolution_note: null, resolution_source: null, brier: null, brier_base: null,
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));

  // State.
  const prevCountries = new Map(content.state.countries.map((c) => [c.country, c]));
  const indicatorChanges = new Map(draft.indicator_changes.map((c) => [c.id, c]));
  const indicators = [
    ...content.state.indicators.map((i) => {
      const c = indicatorChanges.get(i.id);
      return c ? { ...i, status: c.to, since: D, last_evidence: c.evidence, last_evidence_date: D } : i;
    }),
    ...draft.indicators_new.map((n) => ({
      id: n.id, tier: n.tier, name: n.name, description: n.description, countries: n.countries, status: n.status,
      since: D, last_evidence: n.evidence, last_evidence_date: D,
    })),
  ];
  let nextAssumption = Math.max(0, ...content.state.assumptions.map((a) => Number(a.id.slice(1)))) + 1;
  let assumptions = [...content.state.assumptions];
  for (const u of draft.assumption_updates) {
    if (u.op === "add") {
      assumptions.push({ id: `A${nextAssumption++}`, text: u.text!, since: D, status: "active", retired_on: null, retired_reason: null });
    } else if (u.op === "revise") {
      assumptions = assumptions.map((a) => (a.id === u.id ? { ...a, text: u.text!, since: D } : a));
    } else if (u.op === "retire") {
      assumptions = assumptions.map((a) => (a.id === u.id ? { ...a, status: "retired", retired_on: D, retired_reason: u.reason } : a));
    }
  }
  const w = draft.weekly_outlook;
  const state: State = {
    schema_version: 1,
    as_of: D,
    ladder: { current_rung: draft.board.ladder.current_rung, next_rung_odds: draft.board.ladder.next_rung_odds },
    pathways: draft.board.pathways.map(({ pathway, serious_odds, impact, trend }) => ({ pathway, serious_odds, impact, trend })),
    countries: content.state.countries.map(({ country }) => {
      const score = draft.board.countries.find((c) => c.country === country)?.score ?? prevCountries.get(country)!.score;
      const prev = prevCountries.get(country)!;
      return { country, score, since: score !== prev.score ? D : prev.since };
    }),
    indicators,
    assumptions,
    weekly: w ? { as_of: D, medium_term: { question: w.medium_term.question, estimate: w.medium_term.estimate }, long_term: { question: w.long_term.question, estimate: w.long_term.estimate } } : content.state.weekly,
  };

  // The brief, with the numbers code computes: a snapshot of the records added by today (validateAll checks it).
  const counts = pathwayCounts(incidents.filter((i) => i.added <= D), D);
  // Each weekly check keeps the text it assessed: the assumption as it stood before today's updates.
  const assessed = new Map(content.state.assumptions.map((a) => [a.id, a.text]));
  const brief: Brief = {
    ...draft,
    incidents_new: newIncidents,
    strikes_new: newStrikes,
    forecasts_new: draft.forecasts_new,
    weekly_outlook: w && { ...w, assumptions_check: w.assumptions_check.map((a) => ({ ...a, text: assessed.get(a.id)! })) },
    published_at: opts.publishedAt,
    computed: {
      pathways: Object.fromEntries(PATHWAYS.map((p) => [p, { incidents_30d: counts[p].incidents_30d, baseline_monthly: counts[p].baseline_monthly }])) as Brief["computed"]["pathways"],
      word_count: totalWords(draft),
      source_count: draft.sources.length,
      source_category_count: new Set(draft.sources.map((s) => s.category)).size,
    },
  };

  return { brief, incidents, strikes, state, forecasts, archive: { ...content.archive, ...opts.pendingArchive } };
}
