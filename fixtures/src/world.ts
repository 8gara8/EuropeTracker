// SAMPLE world for the validator fixtures. Every event, statement and URL here is invented for tests;
// URLs use the reserved example.org domain. Nothing in fixtures/ is real reporting.

import fs from "node:fs";
import type { AgentContext } from "../../lib/schema/context";
import type { EvidenceSource, ProbabilityEstimate, Source } from "../../lib/schema/common";
import type { Forecast } from "../../lib/schema/forecast";
import type { IncidentBrief } from "../../lib/schema/incident";
import type { State } from "../../lib/schema/state";
import type { Strike } from "../../lib/schema/strike";
import { computedRung, countryFloors, pathwayCounts } from "../../lib/aggregate";
import { addDays, isMonday, windowFor } from "../../lib/dates";
import { TIER1, type PathwayId, type SourceCategoryId } from "../../lib/vocab";

export const url = (slug: string) => `https://example.org/sample/${slug}`;

export const p = (probability: number, term: ProbabilityEstimate["term"], confidence: ProbabilityEstimate["confidence"]): ProbabilityEstimate =>
  ({ probability, term, confidence });

type SourceSeed = { title: string; outlet: string; category: SourceCategoryId; slug: string; language: string; published_at: string | null };

/** Sources the drafts draw on, keyed by a short name. */
export const SOURCES = {
  dorsz: { title: "Komunikat Dowództwa Operacyjnego RSZ (sample)", outlet: "Polish Operational Command", category: "eu_gov_security", slug: "dorsz/2026-10-27-komunikat", language: "pl", published_at: "2026-10-27T23:55:00+01:00" },
  nfp: { title: "Russian drone shot down over eastern Poland (sample)", outlet: "Notes from Poland", category: "eu_regional_press", slug: "notesfrompoland/2026-10-28-drone", language: "en", published_at: "2026-10-28T00:40:00+01:00" },
  uaAir: { title: "Overnight attack: 142 drones and 3 missiles (sample)", outlet: "Ukrainian Air Force (Telegram)", category: "ua_gov", slug: "t.me/kpszsu/2026-10-28", language: "uk", published_at: "2026-10-28T09:10:00+02:00" },
  uaGs: { title: "General Staff: strike on Sheskharis oil terminal (sample)", outlet: "General Staff of the Armed Forces of Ukraine", category: "ua_gov", slug: "generalstaff/2026-10-27-sheskharis", language: "uk", published_at: "2026-10-27T11:20:00+02:00" },
  ruMod: { title: "Defence ministry statement on strikes in Volyn (sample)", outlet: "Russian Ministry of Defence (Telegram)", category: "ru_gov", slug: "t.me/mod_russia/2026-10-28", language: "ru", published_at: "2026-10-28T10:05:00+03:00" },
  krasnodar: { title: "Operational headquarters: fire at Novorossiysk port (sample)", outlet: "Krasnodar Krai operational headquarters (Telegram)", category: "ru_gov", slug: "t.me/opershtab23/2026-10-27", language: "ru", published_at: "2026-10-27T04:30:00+03:00" },
  firms: { title: "FIRMS thermal anomalies, Novorossiysk, 27 October (sample)", outlet: "NASA FIRMS", category: "osint_data", slug: "firms/2026-10-27-novorossiysk", language: "en", published_at: "2026-10-27" },
  reutersEu: { title: "EU fails again to agree 20th sanctions package (sample)", outlet: "Reuters", category: "intl_press", slug: "reuters/2026-10-27-eu-sanctions", language: "en", published_at: "2026-10-27T18:02:00+01:00" },
  yle: { title: "Police link Gulf of Finland cable damage to tanker anchor (sample)", outlet: "Yle News", category: "eu_regional_press", slug: "yle/2026-10-27-cable", language: "en", published_at: "2026-10-27T14:15:00+02:00" },
  krp: { title: "Keskusrikospoliisi: tiedote kaapelivauriosta (sample)", outlet: "Finnish National Bureau of Investigation", category: "eu_gov_security", slug: "poliisi/2026-10-27-tiedote", language: "fi", published_at: "2026-10-27T12:00:00+02:00" },
  isw: { title: "Russian Offensive Campaign Assessment, 27 October (sample)", outlet: "Institute for the Study of War", category: "osint_data", slug: "isw/2026-10-27", language: "en", published_at: "2026-10-28T03:30:00+01:00" },
  tass: { title: "Moscow calls Polish drone claims a provocation (sample)", outlet: "TASS", category: "ru_state_media", slug: "tass/2026-10-28-poland", language: "en", published_at: "2026-10-28T11:12:00+03:00" },
  iaea: { title: "Update on the situation in Ukraine (sample)", outlet: "IAEA", category: "intl_bodies", slug: "iaea/2026-10-27-update", language: "en", published_at: "2026-10-27T16:00:00+01:00" },
  kyivind: { title: "Hungary seeks Druzhba exemption as sanctions talks stall (sample)", outlet: "Kyiv Independent", category: "ua_independent", slug: "kyivindependent/2026-10-27-hungary", language: "en", published_at: "2026-10-27T20:45:00+02:00" },
  market: { title: "Brent settlement and EU gas storage, 27 October (sample)", outlet: "ICE and GIE AGSI market data", category: "markets_energy", slug: "markets/2026-10-27", language: "en", published_at: "2026-10-27" },
  rusi: { title: "Eastern Sentry at two months (sample)", outlet: "RUSI", category: "think_tank", slug: "rusi/2026-10-27-eastern-sentry", language: "en", published_at: "2026-10-27" },
  bloomberg: { title: "Satellite images show damage at Saratov refinery (sample)", outlet: "Bloomberg", category: "intl_press", slug: "bloomberg/2026-10-27-saratov", language: "en", published_at: "2026-10-27T15:30:00+01:00" },
  bryansk: { title: "Governor: drone attack on Klintsy district (sample)", outlet: "Bryansk governor (Telegram)", category: "ru_gov", slug: "t.me/bryansk_gov/2026-10-25", language: "ru", published_at: "2026-10-25T06:40:00+03:00" },
  uaGsKlintsy: { title: "General Staff: strike on ammunition depot near Klintsy (sample)", outlet: "General Staff of the Armed Forces of Ukraine", category: "ua_gov", slug: "generalstaff/2026-10-25-klintsy", language: "uk", published_at: "2026-10-25T12:00:00+02:00" },
  reutersSummit: { title: "EU leaders miss sanctions deadline (sample)", outlet: "Reuters", category: "intl_press", slug: "reuters/2026-10-25-summit", language: "en", published_at: "2026-10-25T21:30:00+02:00" },
  belta: { title: "Snap readiness check of the Western Operational Command ends (sample)", outlet: "Belarusian Ministry of Defence", category: "third_party", slug: "belarus-mod/2026-10-25", language: "ru", published_at: "2026-10-25T17:00:00+03:00" },
  lrt: { title: "Lithuania tracks end of Belarusian exercise near Grodno (sample)", outlet: "LRT English", category: "eu_regional_press", slug: "lrt/2026-10-25-grodno", language: "en", published_at: "2026-10-25T19:00:00+03:00" },
  nato: { title: "NATO statement on Eastern Sentry (sample)", outlet: "NATO", category: "nato_eu", slug: "nato/2026-10-25-eastern-sentry", language: "en", published_at: "2026-10-25T13:00:00+01:00" },
  bnd: { title: "Annual threat assessment briefing (sample)", outlet: "Estonian Foreign Intelligence Service", category: "eu_gov_security", slug: "valisluureamet/2026-10-25", language: "en", published_at: "2026-10-25" },
  carnegie: { title: "How Russia is rebuilding its northern army (sample)", outlet: "Carnegie Russia Eurasia Center", category: "think_tank", slug: "carnegie/2026-10-24-north", language: "en", published_at: "2026-10-24" },
} satisfies Record<string, SourceSeed>;

export type SourceKey = keyof typeof SOURCES;

export function source(id: string, key: SourceKey, accessed_at: string): Source {
  const s = SOURCES[key];
  return { id, title: s.title, outlet: s.outlet, category: s.category, url: url(s.slug), language: s.language, published_at: s.published_at, accessed_at };
}

export function evidenceSource(key: SourceKey): EvidenceSource {
  const s = SOURCES[key];
  return { title: s.title, outlet: s.outlet, category: s.category, url: url(s.slug), published_at: s.published_at };
}

// ---------------------------------------------------------------------------------------------------
// Existing records (the incident database and strike log before the fixture days)

const inc = (id: string, date: string, pathway: PathwayId, type: string, rung: IncidentBrief["rung"], attribution: IncidentBrief["attribution"], affected: IncidentBrief["affected"], summary: string): IncidentBrief =>
  ({ id, date, affected, pathway, type, rung, attribution, summary });

export const INCIDENTS: IncidentBrief[] = [
  inc("INC-2026-0118", "2026-10-05", "airspace", "drone_incursion", 3, 3, ["PL"], "Polish Operational Command said three Russian drones entered Lublin Voivodeship during an attack on Volyn; two were shot down."),
  inc("INC-2026-0121", "2026-10-11", "cyber_ew", "gnss_jamming", 1, 3, ["EE", "LV", "LT", "FI"], "Finnish and Estonian aviation authorities reported GPS interference that forced two Helsinki–Tallinn flights to divert."),
  inc("INC-2026-0124", "2026-10-16", "maritime", "cable_damage", 2, 2, ["FI", "EE"], "A data cable between Finland and Estonia was damaged; Finnish police detained a tanker suspected of dragging its anchor."),
  inc("INC-2026-0126", "2026-10-19", "airspace", "debris_impact", 3, 3, ["RO"], "Drone debris fell near Galați after a Russian attack on Izmail; Romania's defence ministry confirmed the fragments."),
  inc("INC-2026-0127", "2026-10-21", "airspace", "balloon_incursion", 1, 2, ["LT"], "Smuggling balloons from Belarus forced Vilnius airport to suspend flights for three hours."),
  inc("INC-2026-0128", "2026-10-23", "airspace", "drone_incursion", 3, 3, ["MD"], "Moldova's defence ministry said a Russian drone crossed its airspace near Ocnița before re-entering Ukraine."),
  inc("INC-2026-0129", "2026-10-24", "sabotage", "arson", 2, 2, ["PL"], "Prosecutors in Wrocław opened an investigation into a fire at a logistics warehouse, examining a foreign-service link."),
  inc("INC-2026-0130", "2026-10-25", "military_pressure", "snap_readiness", 1, 4, ["PL", "LT"], "Belarus held a snap readiness check of about 3,000 troops near Grodno, close to the Polish and Lithuanian borders."),
];

const strike = (id: string, date: string, target_name: string, target_type: Strike["target_type"], region: string, distance_km: number, verification: Strike["verification"], damage: string | null, summary: string, sources: EvidenceSource[]): Strike => ({
  id, date, target_name, target_type, region, occupied_territory: false, lat: null, lon: null, distance_km, weapon: "drone", weapon_detail: null,
  western_weapon: null, verification, damage, effect: null, summary, sources, seed: false, added: addDays(date, 1), updated: null,
});

export const STRIKES: Strike[] = [
  strike("STR-2026-0450", "2026-10-17", "Ryazan oil refinery", "refinery", "Ryazan Oblast", 480, 4, "Satellite images show a burned crude distillation unit.", "Drones hit the Ryazan refinery; imagery confirmed damage to a primary processing unit.", [evidenceSource("uaGs"), evidenceSource("bloomberg")]),
  strike("STR-2026-0452", "2026-10-21", "Saratov oil refinery", "refinery", "Saratov Oblast", 520, 2, null, "The Saratov governor reported a drone attack and a fire at an industrial site in the city.", [evidenceSource("uaGs"), evidenceSource("ruMod")]),
  strike("STR-2026-0455", "2026-10-23", "Ammunition depot near Kotluban", "ammunition_depot", "Volgograd Oblast", 300, 3, null, "Ukraine claimed a strike on an ammunition depot; fire detections confirmed a blaze at the site.", [evidenceSource("uaGs"), evidenceSource("firms")]),
  strike("STR-2026-0456", "2026-10-25", "Ammunition depot near Klintsy", "ammunition_depot", "Bryansk Oblast", 60, 2, null, "The Bryansk governor reported a drone attack on the Klintsy district and a fire at a military site.", [evidenceSource("uaGsKlintsy"), evidenceSource("bryansk")]),
];

const forecast = (f: Partial<Forecast> & Pick<Forecast, "id" | "question" | "resolution_criteria" | "resolves_by" | "horizon" | "pathway" | "probability" | "base_rate" | "base_rate_note" | "opened">): Forecast =>
  ({ updates: [], status: "open", resolved_on: null, resolution_note: null, resolution_source: null, brier: null, brier_base: null, ...f });

export const FORECASTS: Forecast[] = [
  forecast({ id: "F-2026-005", question: "Will EU leaders adopt a 20th sanctions package against Russia by 25 October 2026?", resolution_criteria: "The Council of the EU announces adoption of the 20th package on or before 25 October 2026.", resolves_by: "2026-10-25", horizon: "30d", pathway: "political_economic", probability: 40, base_rate: 55, base_rate_note: "Most earlier packages were adopted within a month of their target date, a few after vetoes.", opened: "2026-09-28" }),
  forecast({ id: "F-2026-008", question: "Will Finland or Estonia charge anyone over the October 2026 Gulf of Finland cable damage by 31 January 2027?", resolution_criteria: "A Finnish or Estonian prosecutor announces charges connected to the 16 October 2026 cable damage.", resolves_by: "2027-01-31", horizon: "90d", pathway: "maritime", probability: 35, base_rate: 30, base_rate_note: "Two of seven Baltic cable cases since 2023 led to charges within four months.", opened: "2026-10-17" }),
  forecast({ id: "F-2026-011", question: "Will Poland request NATO Article 4 consultations before 31 December 2026?", resolution_criteria: "Poland formally requests consultations under Article 4 of the North Atlantic Treaty.", resolves_by: "2026-12-31", horizon: "90d", pathway: "airspace", probability: 10, base_rate: 5, base_rate_note: "Poland has requested Article 4 consultations once since 2022.", opened: "2026-10-06" }),
  forecast({ id: "F-2026-012", question: "Will the IAEA report a complete loss of off-site power at Zaporizhzhia before 31 December 2026?", resolution_criteria: "An IAEA statement reports that the plant lost all off-site power, however briefly.", resolves_by: "2026-12-31", horizon: "90d", pathway: "nuclear", probability: 45, base_rate: 40, base_rate_note: "The plant lost all off-site power about once every three months since 2022.", opened: "2026-10-12" }),
];

// ---------------------------------------------------------------------------------------------------
// State and context

const placeholder = JSON.parse(fs.readFileSync("fixtures/src/base-state.json", "utf8")) as State;

const PATHWAY_STATE: State["pathways"] = [
  { pathway: "airspace", serious_odds: p(30, "unlikely", "moderate"), impact: 3, trend: "flat" },
  { pathway: "sabotage", serious_odds: p(15, "highly_unlikely", "moderate"), impact: 3, trend: "flat" },
  { pathway: "maritime", serious_odds: p(15, "highly_unlikely", "low"), impact: 3, trend: "flat" },
  { pathway: "cyber_ew", serious_odds: p(10, "highly_unlikely", "moderate"), impact: 2, trend: "flat" },
  { pathway: "military_pressure", serious_odds: p(5, "remote", "moderate"), impact: 5, trend: "flat" },
  { pathway: "nuclear", serious_odds: p(5, "remote", "high"), impact: 5, trend: "flat" },
  { pathway: "political_economic", serious_odds: p(10, "highly_unlikely", "low"), impact: 3, trend: "flat" },
];

const ACTIVE_BEFORE: Record<string, { status: "watch" | "active"; since: string; evidence: string }> = {
  "ind-airspace-tempo": { status: "watch", since: "2026-10-20", evidence: "Three airspace incidents in 30 days against a baseline of 1.3 a month." },
  "ind-border-tracks": { status: "active", since: "2026-10-06", evidence: "Russian drone routes to Volyn and Lviv pass within a few kilometres of the Polish border." },
  "ind-gnss-baltic": { status: "active", since: "2026-10-12", evidence: "Jamming forced two Helsinki–Tallinn diversions on 11 October." },
  "ind-undersea": { status: "watch", since: "2026-10-17", evidence: "Gulf of Finland data cable damaged on 16 October." },
};

export function stateAsOf(asOf: string, opts: { airspace?: number; airspaceTrend?: "up" | "flat"; airspaceActive?: boolean } = {}): State {
  return {
    ...placeholder,
    as_of: asOf,
    ladder: { current_rung: 3, next_rung_odds: p(15, "highly_unlikely", "moderate") },
    pathways: PATHWAY_STATE.map((x) => x.pathway === "airspace" && opts.airspace
      ? { ...x, serious_odds: p(opts.airspace, "unlikely", "moderate"), trend: opts.airspaceTrend ?? "flat" }
      : x),
    countries: [
      { country: "PL", score: 3, since: "2026-10-06" },
      { country: "LT", score: 2, since: "2026-10-12" },
      { country: "LV", score: 2, since: "2026-10-12" },
      { country: "EE", score: 3, since: "2026-10-17" },
      { country: "FI", score: 3, since: "2026-10-17" },
      { country: "RO", score: 3, since: "2026-10-20" },
      { country: "MD", score: 3, since: "2026-10-24" },
    ],
    indicators: placeholder.indicators.map((i) => {
      const a = ACTIVE_BEFORE[i.id];
      if (opts.airspaceActive && i.id === "ind-airspace-tempo") {
        return { ...i, status: "active", since: "2026-10-28", last_evidence: "Five airspace incidents in 30 days against a 90-day baseline of 1.3 a month.", last_evidence_date: "2026-10-28" };
      }
      return a ? { ...i, status: a.status, since: a.since, last_evidence: a.evidence, last_evidence_date: a.since } : i;
    }),
    weekly: {
      as_of: "2026-10-19",
      medium_term: { question: "Will Russia conduct a deliberate, attributable armed attack on NATO territory in the next 12 months?", estimate: p(10, "highly_unlikely", "low") },
      long_term: { question: "Will Russia and a NATO member be in direct armed conflict by the end of 2030?", estimate: p(20, "highly_unlikely", "low") },
    },
  };
}

export const RECENT_BRIEFS = [
  { date: "2026-10-24", title: "SAMPLE — Moldova reports Russian drone over Ocnița", bottom_line: "Rung 3 holds after a Russian drone crossed Moldovan airspace near Ocnița.", judgement: "Strays follow strike routes; no sign of deliberate probing." },
  { date: "2026-10-25", title: "SAMPLE — Wrocław warehouse fire examined for foreign link", bottom_line: "Polish prosecutors are examining a foreign-service link to a warehouse fire in Wrocław.", judgement: "Sabotage tempo is at baseline; one case does not change the odds." },
  { date: "2026-10-26", title: "SAMPLE — Weekly outlook: spillover risk steady at rung 3", bottom_line: "Risk steady at rung 3; EU leaders missed their sanctions deadline.", judgement: "Medium-term risk unchanged at highly unlikely." },
  { date: "2026-10-27", title: "SAMPLE — Belarus exercise ends; Saratov damage confirmed", bottom_line: "Belarus ended its snap check on schedule; imagery confirmed damage at the Saratov refinery.", judgement: "No change to the board." },
  { date: "2026-10-28", title: "SAMPLE — Russian drone crosses into Poland; Novorossiysk oil terminal struck", bottom_line: "A Russian drone was shot down over Lublin Voivodeship; airspace odds rise to unlikely (35%).", judgement: "Incursions fit the strike-route pattern; ladder stays at rung 3." },
];

export function contextFor(date: string, opts: {
  state: State;
  incidents: IncidentBrief[];
  strikes: Strike[];
  forecasts: Forecast[];
  nextIncident: string;
  nextStrike: string;
  nextForecast: string;
}): AgentContext {
  const last30 = opts.incidents.filter((i) => i.date >= addDays(date, -29) && i.date <= date);
  const floors = countryFloors(last30, date);
  const counts = pathwayCounts(last30.map((i) => ({ ...i, serious: false })), date);
  return {
    date,
    window: windowFor(date),
    weekly: isMonday(date),
    deadline: `${date}T06:45:00+08:00`,
    state: opts.state,
    computed: {
      current_rung: computedRung(last30, date),
      pathways: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { ...v, baseline_monthly: { airspace: 1.3, sabotage: 1.7, maritime: 1, cyber_ew: 0.7, military_pressure: 0.3, nuclear: 0.3, political_economic: 0.7 }[k as PathwayId], serious_12m: 0, monthly_avg_since_2022: 1.1 }])) as AgentContext["computed"]["pathways"],
      countries: Object.fromEntries(TIER1.map((c) => [c, floors[c]])) as AgentContext["computed"]["countries"],
      incidents_last_30d: last30,
    },
    next_ids: {
      incident: { "2025": "INC-2025-0164", "2026": opts.nextIncident },
      strike: { "2025": "STR-2025-0412", "2026": opts.nextStrike },
      forecast: opts.nextForecast,
    },
    open_forecasts: opts.forecasts.filter((f) => f.status === "open"),
    recent_briefs: RECENT_BRIEFS.filter((b) => b.date < date).slice(-3),
    recent_strikes: opts.strikes.filter((s) => s.date >= addDays(date, -13) && s.date <= date),
    active_assumptions: opts.state.assumptions.filter((a) => a.status === "active"),
    pack: { md: `research/packs/${date}.md`, json: `research/packs/${date}.json`, degraded: false, failed_feeds: [] },
  };
}

/** URLs in the day's pack that the drafts don't cite, so evidence sets aren't just the citations. */
export function packNoise(date: string): string[] {
  return [url(`pack/${date}/ukrinform-frontline`), url(`pack/${date}/delfi-baltic-air-policing`), url(`pack/${date}/digi24-galati`)];
}
