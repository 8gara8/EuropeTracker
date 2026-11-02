// SAMPLE dataset for site previews (SPEC §9 Phase 2): ten consecutive briefs (20–29 October 2026, with
// one Monday and one quiet day), about 40 incidents since 2024 across all seven pathways, 15 strikes,
// 8 forecasts (3 resolved) and a matching state. Invented content; see world.ts. Written to
// fixtures/site-content/ and checked with validateAll().

import fs from "node:fs";
import path from "node:path";
import { brier, pathwayCounts } from "../../lib/aggregate";
import { addDays, windowFor } from "../../lib/dates";
import { sourceRefs } from "../../lib/rules/sources";
import { totalWords } from "../../lib/rules/words";
import { Brief } from "../../lib/schema/brief";
import type { EvidenceSource, ProbabilityEstimate } from "../../lib/schema/common";
import type { CountryScore, Development, DraftBrief } from "../../lib/schema/draft-brief";
import type { Forecast } from "../../lib/schema/forecast";
import type { Incident } from "../../lib/schema/incident";
import type { State } from "../../lib/schema/state";
import type { Strike } from "../../lib/schema/strike";
import { normalizeUrl } from "../../lib/urls";
import { validateAll } from "../../lib/validate";
import { CATEGORIES, NO_CHANGE_TEXT, PATHWAYS, TIER1, type CategoryId, type CountryCode, type PathwayId, type Score } from "../../lib/vocab";
import { monday, quiet, weekday } from "./drafts";
import { FORECASTS, INCIDENTS, STRIKES, evidenceSource, p, source, stateAsOf, url, type SourceKey } from "./world";

const OUT = "fixtures/site-content";
const clone = <T>(v: T): T => structuredClone(v);
const ev = (title: string, outlet: string, category: EvidenceSource["category"], slug: string, published_at: string | null = null): EvidenceSource =>
  ({ title: `${title} (sample)`, outlet, category, url: url(slug), published_at });

// ---------------------------------------------------------------------------------------------------
// Incidents: seed history since 2024, then October 2026 in detail

type Hist = [date: string, pathway: PathwayId, type: string, rung: Incident["rung"], location: Incident["location_country"], affected: CountryCode[], attribution: Incident["attribution"], summary: string, extra?: Partial<Incident>];

const HISTORY: Hist[] = [
  ["2024-01-14", "cyber_ew", "gnss_jamming", 1, "EE", ["EE", "FI"], 3, "Aviation authorities reported GPS interference that disrupted approaches to Tallinn and Helsinki for several days."],
  ["2024-02-01", "political_economic", "migration_pressure", 1, "FI", ["FI"], 3, "Finland kept its eastern crossings closed after officials said Russia was steering asylum seekers to the border.", { date_precision: "month" }],
  ["2024-03-23", "airspace", "missile_incursion", 3, "PL", ["PL"], 3, "Polish Operational Command said a Russian cruise missile crossed Polish airspace for under a minute during strikes on western Ukraine."],
  ["2024-04-18", "sabotage", "sabotage_arrest", 2, "DE", ["DE"], 4, "Prosecutors charged two men with planning attacks on military and rail sites on behalf of Russian intelligence."],
  ["2024-05-07", "nuclear", "nuclear_exercise", 1, "RU", ["PL", "LT", "LV", "EE", "FI"], 4, "Russia announced exercises of its non-strategic nuclear forces near Ukraine, later joined by Belarus."],
  ["2024-06-13", "political_economic", "influence_operation", 2, "CZ", ["CZ", "PL", "BE"], 3, "Czech authorities sanctioned a Russian-funded news network accused of paying European politicians."],
  ["2024-07-22", "sabotage", "explosive", 2, "DE", ["DE", "GB"], 3, "Parcels fitted with incendiary devices caught fire at courier hubs; investigators linked the plot to Russian military intelligence."],
  ["2024-09-07", "airspace", "drone_incursion", 3, "LV", ["LV"], 3, "A Russian attack drone crashed in eastern Latvia after straying from a strike on Ukraine."],
  ["2024-10-01", "cyber_ew", "election_cyber", 2, "MD", ["MD"], 3, "Moldova reported cyberattacks on electoral systems during its presidential vote and EU referendum.", { date_precision: "month" }],
  ["2024-11-18", "maritime", "cable_damage", 2, "LT", ["LT", "SE", "FI", "DE"], 2, "Two Baltic data cables were cut within a day; a bulk carrier was suspected of dragging its anchor.", { sea: "baltic" }],
  ["2024-12-25", "maritime", "cable_damage", 3, "FI", ["FI", "EE"], 3, "A Finland–Estonia power cable and several data cables were damaged; Finnish authorities detained a shadow-fleet tanker.", { sea: "baltic" }],
  ["2025-01-26", "maritime", "cable_damage", 2, "SE", ["SE", "LV"], 2, "A data cable between Sweden and Latvia was damaged; Swedish authorities boarded a vessel and later released it.", { sea: "baltic" }],
  ["2025-02-01", "military_pressure", "force_buildup", 1, "RU", ["FI", "EE"], 3, "Finnish officials reported Russia expanding garrisons and depots near the Finnish border.", { date_precision: "month" }],
  ["2025-03-11", "airspace", "debris_impact", 4, "RO", ["RO"], 3, "One person was killed and two injured when drone debris struck a house near the Danube during a Russian attack on Ukrainian ports.", { serious: true, casualties: { killed: 1, injured: 2 } }],
  ["2025-04-14", "sabotage", "rail_sabotage", 2, "PL", ["PL"], 3, "Explosives damaged a rail line used to supply Ukraine; Polish authorities blamed saboteurs working for Russian services."],
  ["2025-05-19", "political_economic", "election_interference", 2, "RO", ["RO"], 3, "Romanian authorities said coordinated online campaigns and illegal funding targeted the presidential run-off."],
  ["2025-06-09", "cyber_ew", "gnss_spoofing", 1, "LT", ["LT", "LV", "EE", "PL"], 3, "The Baltic states reported a sharp rise in GPS spoofing affecting aircraft, which they traced to Kaliningrad."],
  ["2025-07-15", "airspace", "aircraft_violation", 3, "EE", ["EE"], 3, "A Russian fighter entered Estonian airspace over the Gulf of Finland for about two minutes before allied jets escorted it out."],
  ["2025-08-20", "maritime", "naval_confrontation", 3, "EE", ["EE"], 3, "A Russian fighter flew close to an Estonian patrol vessel shadowing a sanctioned tanker in the Gulf of Finland.", { sea: "baltic" }],
  ["2025-09-10", "airspace", "shootdown", 3, "PL", ["PL"], 4, "Allied jets shot down several Russian drones that crossed into Poland; NATO allies jointly condemned the incursion.", { disruption_hours: 6 }],
  ["2025-09-22", "airspace", "airport_closure", 3, "DK", ["DK", "NO"], 2, "Copenhagen and Oslo airports closed for hours after large drones were seen nearby; officials did not rule out a state actor.", { disruption_hours: 4 }],
  ["2025-10-01", "political_economic", "energy_coercion", 1, "HU", ["HU", "SK"], 3, "Russia cut gas flows to Hungary and Slovakia in a pricing dispute that both governments called coercion.", { date_precision: "month" }],
  ["2025-11-16", "sabotage", "rail_sabotage", 2, "PL", ["PL"], 3, "An explosion damaged the Warsaw–Lublin railway used for supplies to Ukraine; Poland blamed Russian services."],
  ["2025-12-04", "nuclear", "plant_safety_event", 1, "UA", ["RO", "MD"], 4, "The IAEA reported that the Zaporizhzhia plant lost all off-site power, again relying on diesel generators."],
  ["2026-01-20", "cyber_ew", "cyberattack", 2, "PL", ["PL"], 3, "A cyberattack disrupted a regional water utility in northern Poland; officials attributed it to a Russian group."],
  ["2026-03-02", "military_pressure", "exercise_near_border", 1, "BY", ["PL", "LT"], 4, "Belarus and Russia began a joint exercise near Grodno and Brest, close to the Suwałki corridor."],
  ["2026-04-28", "airspace", "drone_incursion", 3, "RO", ["RO"], 3, "Romanian radar tracked a Russian drone over Tulcea county for about 20 minutes before it left toward Ukraine."],
  ["2026-06-11", "maritime", "shadow_fleet_incident", 2, "DE", ["DE", "DK"], 3, "German authorities detained an unseaworthy shadow-fleet tanker that drifted without power off Rügen.", { sea: "baltic" }],
  ["2026-07-30", "sabotage", "arson", 2, "LT", ["LT"], 3, "Arson destroyed a warehouse in Vilnius; Lithuanian prosecutors charged suspects they said were recruited by Russian services."],
  ["2026-09-12", "airspace", "drone_incursion", 3, "PL", ["PL"], 3, "Two Russian drones entered Polish airspace from Belarus and were tracked for 15 minutes before leaving."],
  ["2026-09-24", "cyber_ew", "gnss_jamming", 1, "FI", ["FI", "EE"], 3, "Finnish authorities reported GPS jamming that disrupted flights into Helsinki for three days."],
];

function seedIncidents(): Incident[] {
  const seq: Record<string, number> = {};
  return HISTORY.map(([date, pathway, type, rung, location_country, affected, attribution, summary, extra]) => {
    const year = date.slice(0, 4);
    seq[year] = (seq[year] ?? -4) + 7;
    const id = `INC-${year}-${String(seq[year]).padStart(4, "0")}`;
    return {
      id, date, date_precision: "day", location_country, affected, location: null, sea: null, pathway, type, rung,
      serious: false, summary, attribution, attribution_note: null, host_statement: "yes",
      casualties: { killed: 0, injured: 0 }, disruption_hours: null,
      sources: [ev(`Incident compilation entry ${id}`, "Sample incident compilation", "think_tank", `seed/${id}`)],
      seed: true, added: "2026-10-15", updated: null, ...extra,
    } satisfies Incident;
  });
}

const OCTOBER_DETAILS: Record<string, { location: string; location_country?: Incident["location_country"]; note: string; sources: EvidenceSource[]; added: string; extra?: Partial<Incident> }> = {
  "INC-2026-0118": { location: "Lublin Voivodeship", note: "Polish Operational Command identified the drones as Russian.", sources: [ev("Komunikat DORSZ, 5 October", "Polish Operational Command", "eu_gov_security", "dorsz/2026-10-05", "2026-10-05"), ev("Drones shot down over eastern Poland", "Notes from Poland", "eu_regional_press", "notesfrompoland/2026-10-05", "2026-10-05")], added: "2026-10-06" },
  "INC-2026-0121": { location: "Gulf of Finland", location_country: "EE", note: "Finnish and Estonian authorities attributed the interference to Russia.", sources: [ev("Traficom notice on GPS interference", "Finnish Transport and Communications Agency", "eu_gov_security", "traficom/2026-10-11", "2026-10-11"), ev("Flights divert over GPS jamming", "ERR News", "eu_regional_press", "err/2026-10-11", "2026-10-11")], added: "2026-10-12" },
  "INC-2026-0124": { location: "Gulf of Finland", location_country: "FI", note: "Finnish police tied the damage to the anchor of a shadow-fleet tanker bound for Ust-Luga.", sources: [ev("Police statement on cable damage", "Finnish National Bureau of Investigation", "eu_gov_security", "poliisi/2026-10-16", "2026-10-16"), ev("Data cable to Estonia damaged", "Yle News", "eu_regional_press", "yle/2026-10-16", "2026-10-16"), evidenceSource("krp")], added: "2026-10-17", extra: { sea: "baltic", attribution: 3, updated: "2026-10-28" } },
  "INC-2026-0126": { location: "Galați county", note: "Romania's defence ministry confirmed the fragments came from a Russian drone.", sources: [evidenceSource("roMod"), evidenceSource("digi24Galati")], added: "2026-10-20" },
  "INC-2026-0127": { location: "Vilnius", note: "Lithuanian officials said the balloons were launched by smugglers from Belarus.", sources: [evidenceSource("ltCrisis"), evidenceSource("lrtBalloons")], added: "2026-10-22", extra: { disruption_hours: 3 } },
  "INC-2026-0128": { location: "Ocnița district", note: "Moldova's defence ministry identified the drone as Russian.", sources: [evidenceSource("mdMod"), evidenceSource("newsmaker")], added: "2026-10-24" },
  "INC-2026-0129": { location: "Wrocław", note: "Prosecutors said they are examining a link to foreign services.", sources: [evidenceSource("plProsecutor"), evidenceSource("tvn24")], added: "2026-10-25" },
  "INC-2026-0130": { location: "Grodno region", location_country: "BY", note: "Belarus's defence ministry announced the check.", sources: [ev("Statement on the Belarusian exercise near Grodno", "Lithuanian Armed Forces", "eu_gov_security", "kariuomene/2026-10-25", "2026-10-25"), evidenceSource("belta"), evidenceSource("lrt")], added: "2026-10-26" },
};

function octoberIncidents(): Incident[] {
  const fromWorld = INCIDENTS.map((i): Incident => {
    const d = OCTOBER_DETAILS[i.id]!;
    return {
      id: i.id, date: i.date, date_precision: "day", location_country: d.location_country ?? i.affected[0]!, affected: i.affected,
      location: d.location, sea: null, pathway: i.pathway, type: i.type, rung: i.rung, serious: false, summary: i.summary,
      attribution: i.attribution, attribution_note: d.note, host_statement: "yes", casualties: { killed: 0, injured: 0 },
      disruption_hours: null, sources: d.sources, seed: false, added: d.added, updated: null, ...d.extra,
    };
  });
  const tulcea: Incident = {
    id: "INC-2026-0132", date: "2026-10-28", date_precision: "day", location_country: "RO", affected: ["RO"], location: "Tulcea county",
    sea: null, pathway: "airspace", type: "debris_impact", rung: 3, serious: false,
    summary: "Romanian media reported drone fragments in a field near Tulcea after a Russian attack on Izmail. The defence ministry has not yet confirmed them. No injuries.",
    attribution: 2, attribution_note: "Local officials suspect a Russian drone; the ministry is examining the fragments.", host_statement: "none_yet",
    casualties: { killed: 0, injured: 0 }, disruption_hours: null, sources: [evidenceSource("digi24Tulcea"), evidenceSource("reutersTulcea")],
    seed: false, added: "2026-10-29", updated: null,
  };
  return [...fromWorld, weekday.incidents_new[0]! as Incident, tulcea];
}

// ---------------------------------------------------------------------------------------------------
// Strikes: 15 in September and October 2026

const strike = (id: string, date: string, added: string, target_name: string, target_type: Strike["target_type"], region: string, distance_km: number, verification: Strike["verification"], summary: string, sources: EvidenceSource[], extra: Partial<Strike> = {}): Strike => ({
  id, date, target_name, target_type, region, occupied_territory: false, lat: null, lon: null, distance_km, weapon: "drone",
  weapon_detail: null, western_weapon: null, verification, damage: null, effect: null, summary, sources, seed: false, added, updated: null, ...extra,
});

const gs = (slug: string) => ev("General Staff statement", "General Staff of the Armed Forces of Ukraine", "ua_gov", `generalstaff/${slug}`);
const firms = (slug: string) => ev("FIRMS thermal anomalies", "NASA FIRMS", "osint_data", `firms/${slug}`);

function strikes(): Strike[] {
  const world = Object.fromEntries(STRIKES.map((s) => [s.id, s]));
  const saratov: Strike = {
    ...world["STR-2026-0452"]!, added: "2026-10-22", verification: 4,
    damage: weekday.strike_updates[0]!.changes.damage, updated: "2026-10-28",
    sources: [evidenceSource("uaGs"), evidenceSource("saratovGov"), evidenceSource("bloomberg")],
  };
  return [
    strike("STR-2026-0440", "2026-09-20", "2026-09-21", "Volgograd oil refinery", "refinery", "Volgograd Oblast", 420, 4, "Drones struck the Volgograd refinery; imagery showed a damaged distillation unit.", [gs("2026-09-20"), ev("Imagery confirms Volgograd refinery damage", "Reuters", "intl_press", "reuters/2026-09-21-volgograd")], { damage: "Imagery showed a damaged primary distillation unit." }),
    strike("STR-2026-0442", "2026-09-24", "2026-09-25", "Oil depot near Feodosia", "oil_depot", "Crimea (occupied)", 250, 3, "Ukraine claimed a strike on a fuel depot in occupied Crimea; fire detections confirmed a blaze.", [gs("2026-09-24"), firms("2026-09-24-feodosia")], { occupied_territory: true }),
    strike("STR-2026-0444", "2026-09-28", "2026-09-29", "Engels airbase", "airbase", "Saratov Oblast", 600, 2, "The Saratov governor reported a drone attack near Engels; Ukraine said it targeted the airbase.", [gs("2026-09-28"), ev("Governor reports drone attack near Engels", "Saratov governor (Telegram)", "ru_gov", "t.me/saratov_gov/2026-09-28")]),
    strike("STR-2026-0446", "2026-10-02", "2026-10-03", "Explosives plant in Bryansk Oblast", "defence_industry", "Bryansk Oblast", 110, 3, "Drones hit a plant producing explosives; fire detections confirmed a blaze at the site.", [gs("2026-10-02"), firms("2026-10-02-bryansk")]),
    strike("STR-2026-0447", "2026-10-05", "2026-10-06", "Primorsk oil terminal", "oil_terminal", "Leningrad Oblast", 900, 4, "Drones struck the Baltic export terminal at Primorsk; loading was halted for two days.", [gs("2026-10-05"), ev("Primorsk loadings halted after drone attack", "Bloomberg", "intl_press", "bloomberg/2026-10-06-primorsk")], { damage: "A loading berth and a storage tank were damaged." }),
    strike("STR-2026-0448", "2026-10-09", "2026-10-10", "Power substation in Kursk Oblast", "power", "Kursk Oblast", 90, 2, "The Kursk governor reported power cuts after a drone attack on a substation.", [gs("2026-10-09"), ev("Governor: power cuts after drone attack", "Kursk governor (Telegram)", "ru_gov", "t.me/kursk_gov/2026-10-09")]),
    strike("STR-2026-0449", "2026-10-13", "2026-10-14", "Ammunition depot in Belgorod Oblast", "ammunition_depot", "Belgorod Oblast", 40, 1, "Ukraine's General Staff claimed a strike on an ammunition depot; there is no independent confirmation yet.", [gs("2026-10-13")]),
    world["STR-2026-0450"]!,
    strike("STR-2026-0451", "2026-10-19", "2026-10-20", "Air-defence radar near Dzhankoi", "radar", "Crimea (occupied)", 180, 3, "Ukraine claimed a strike on an air-defence radar in northern Crimea; geolocated footage confirmed the hit.", [gs("2026-10-19"), ev("Geolocated footage of radar strike", "GeoConfirmed", "osint_data", "geoconfirmed/2026-10-19-dzhankoi")], { occupied_territory: true, weapon: "missile", weapon_detail: "Neptune" }),
    saratov,
    strike("STR-2026-0453", "2026-10-22", "2026-10-24", "Rail junction near Kursk", "logistics_rail", "Kursk Oblast", 100, 1, "Ukraine claimed a strike on a rail junction used to supply Russian forces.", [gs("2026-10-22-rail")]),
    strike("STR-2026-0454", "2026-10-22", "2026-10-24", "Morozovsk airbase", "airbase", "Rostov Oblast", 220, 2, "The Rostov governor reported a drone attack on Morozovsk; Ukraine said it targeted the airbase.", [gs("2026-10-22-morozovsk"), ev("Governor reports drone attack on Morozovsk", "Rostov governor (Telegram)", "ru_gov", "t.me/rostov_gov/2026-10-22")]),
    { ...world["STR-2026-0455"]!, added: "2026-10-24" },
    world["STR-2026-0456"]!,
    weekday.strikes_new[0]! as Strike,
  ];
}

// ---------------------------------------------------------------------------------------------------
// Forecasts: 8, three resolved

function forecasts(): Forecast[] {
  const resolved = (f: Forecast): Forecast => ({ ...f, ...brier(f) });
  const open = (d: DraftBrief, i = 0): Forecast => ({ ...d.forecasts_new[i]!, opened: d.date, updates: [], status: "open", resolved_on: null, resolution_note: null, resolution_source: null, brier: null, brier_base: null });
  const base = Object.fromEntries(FORECASTS.map((f) => [f.id, f]));
  return [
    resolved({ id: "F-2026-001", question: "Will Russian drones or missiles enter NATO airspace between 1 and 30 September 2026?", resolution_criteria: "A NATO member's government confirms a Russian drone or missile in its airspace in the period.", resolves_by: "2026-09-30", horizon: "30d", pathway: "airspace", probability: 70, base_rate: 75, base_rate_note: "Incursions occurred in 9 of the previous 12 months.", opened: "2026-08-31", updates: [{ date: "2026-09-08", probability: 75, note: "Strikes near the Polish border intensified." }], status: "resolved_yes", resolved_on: "2026-09-13", resolution_note: "Two Russian drones entered Polish airspace on 12 September.", resolution_source: ev("Drones enter Polish airspace", "Polish Operational Command", "eu_gov_security", "dorsz/2026-09-12"), brier: null, brier_base: null }),
    resolved({ id: "F-2026-003", question: "Will any NATO member request Article 4 consultations between 15 September and 15 October 2026?", resolution_criteria: "A NATO member formally requests consultations under Article 4.", resolves_by: "2026-10-15", horizon: "30d", pathway: null, probability: 15, base_rate: 10, base_rate_note: "Two Article 4 requests since 2022.", opened: "2026-09-15", updates: [], status: "resolved_no", resolved_on: "2026-10-16", resolution_note: "No member requested consultations in the period.", resolution_source: ev("NATO press briefing", "NATO", "nato_eu", "nato/2026-10-16"), brier: null, brier_base: null }),
    resolved({ ...base["F-2026-005"]!, status: "resolved_no", resolved_on: "2026-10-26", resolution_note: monday.forecast_resolutions[0]!.note, resolution_source: evidenceSource("reutersSummit") }),
    base["F-2026-008"]!,
    { ...base["F-2026-011"]!, updates: [{ date: "2026-10-28", probability: weekday.forecast_updates[0]!.probability, note: weekday.forecast_updates[0]!.note }] },
    base["F-2026-012"]!,
    open(monday),
    open(weekday),
  ];
}

// ---------------------------------------------------------------------------------------------------
// Briefs: 20–29 October

const DAILY: Record<string, { airspace: number; sabotage: number; nextOdds: number; scores: Partial<Record<CountryCode, Score>>; drones: number }> = {
  "2026-10-19": { airspace: 25, sabotage: 10, nextOdds: 10, scores: { RO: 2, MD: 2 }, drones: 90 },
  "2026-10-20": { airspace: 25, sabotage: 10, nextOdds: 10, scores: { RO: 3, MD: 2 }, drones: 96 },
  "2026-10-21": { airspace: 25, sabotage: 10, nextOdds: 10, scores: { RO: 3, MD: 2 }, drones: 120 },
  "2026-10-22": { airspace: 30, sabotage: 10, nextOdds: 10, scores: { RO: 3, MD: 2 }, drones: 88 },
  "2026-10-23": { airspace: 30, sabotage: 10, nextOdds: 10, scores: { RO: 3, MD: 2 }, drones: 64 },
  "2026-10-24": { airspace: 30, sabotage: 10, nextOdds: 15, scores: { RO: 3, MD: 3 }, drones: 131 },
  "2026-10-25": { airspace: 30, sabotage: 15, nextOdds: 15, scores: { RO: 3, MD: 3 }, drones: 102 },
  "2026-10-26": { airspace: 30, sabotage: 15, nextOdds: 15, scores: { RO: 3, MD: 3 }, drones: 97 },
  "2026-10-27": { airspace: 30, sabotage: 15, nextOdds: 15, scores: { RO: 3, MD: 3 }, drones: 115 },
  "2026-10-28": { airspace: 35, sabotage: 15, nextOdds: 15, scores: { RO: 3, MD: 3 }, drones: 142 },
  "2026-10-29": { airspace: 35, sabotage: 15, nextOdds: 15, scores: { RO: 3, MD: 3 }, drones: 74 },
};

const BASE_SCORES: Record<(typeof TIER1)[number], Score> = { PL: 3, LT: 2, LV: 2, EE: 3, FI: 3, RO: 3, MD: 3 };
const scoreOn = (date: string, c: (typeof TIER1)[number]): Score => DAILY[date]!.scores[c] ?? BASE_SCORES[c];
const odds = (n: number): ProbabilityEstimate => p(n, n <= 5 ? "remote" : n <= 20 ? "highly_unlikely" : n <= 35 ? "unlikely" : "realistic_possibility", "moderate");

const CHANGE_REASONS: Partial<Record<CountryCode, string>> = {
  RO: "Drone debris fell near Galați on 19 October during a Russian attack on Izmail.",
  MD: "A Russian drone crossed Moldovan airspace near Ocnița on 23 October.",
};

function pathwaysFor(date: string, incidents: Incident[]): DraftBrief["board"]["pathways"] {
  const today = DAILY[date]!;
  const before = DAILY[addDays(date, -1)]!;
  const counts = pathwayCounts(incidents.filter((i) => i.added <= date), date);
  return weekday.board.pathways.map((x) => {
    const prob = x.pathway === "airspace" ? today.airspace : x.pathway === "sabotage" ? today.sabotage : x.serious_odds.probability;
    const prev = x.pathway === "airspace" ? before.airspace : x.pathway === "sabotage" ? before.sabotage : prob;
    const c = counts[x.pathway];
    return {
      ...x,
      serious_odds: { ...odds(prob), confidence: x.serious_odds.confidence },
      trend: prob - prev >= 5 ? "up" : prev - prob >= 5 ? "down" : "flat",
      rationale: `${c.incidents_30d} incident${c.incidents_30d === 1 ? "" : "s"} in 30 days against a baseline of ${c.baseline_monthly} a month${prob !== prev ? "; raised after today's incident" : "; no change"}.`,
    };
  });
}

function countriesFor(date: string, sourceIds: string[]): CountryScore[] {
  return TIER1.map((c) => {
    const score = scoreOn(date, c);
    const previous = scoreOn(addDays(date, -1), c);
    return { country: c, score, previous_score: previous, reason: score !== previous ? CHANGE_REASONS[c] ?? null : null, source_ids: score !== previous ? sourceIds : [], indicator_ids: [], cohesion_flag: false };
  });
}

const GENERIC_DEVS: Development[] = [
  { id: "d2", headline: "Russia's overnight raid targets energy sites in eastern Ukraine", summary: "Ukraine's Air Force said most of the drones were aimed at energy sites in the Kharkiv and Sumy regions, far from NATO borders. Repair crews restored power to most consumers by morning.", category: "russian_strikes", importance: "notable", incident_ids: [], strike_ids: [], verification: null, attribution: null, russian_framing: "TASS said the strikes hit military and energy facilities used by Ukraine's armed forces (claim).", source_ids: ["s3", "s11"] },
  { id: "d3", headline: "Russian forces make small gains near Pokrovsk", summary: "DeepState and ISW recorded small Russian advances south of Pokrovsk. Neither reported signs of an operational breakthrough, and Ukrainian forces held the main supply roads.", category: "battlefield", importance: "notable", incident_ids: [], strike_ids: [], verification: null, attribution: null, russian_framing: null, source_ids: ["s10"] },
];

function categoriesFor(devs: Development[]): DraftBrief["categories"] {
  return CATEGORIES.map((category: CategoryId) => {
    const d = devs.find((x) => x.category === category);
    return d
      ? { category, status: "material" as const, text: `${d.headline}.`, development_ids: [d.id], source_ids: d.source_ids }
      : { category, status: "no_change" as const, text: NO_CHANGE_TEXT, development_ids: [], source_ids: [] };
  });
}

function judgementFor(dayLine: string, nextOdds: number): string {
  return [
    `We assess that spillover risk is steady, with the ladder at rung 3 because of stray drones and debris from Russian strikes near NATO's eastern borders. ${dayLine} The pattern this month is consistent with spillover from strikes on western Ukraine and the Danube ports rather than deliberate probing: the drones flew on strike headings and none loitered over allied territory.`,
    "Russia's covert campaign continues at about its usual pace. Sabotage and undersea incidents remain near their baselines, and officials have not reported new arrests in the window. The sanctions talks are a cohesion problem for the EU rather than a spillover driver, although delays keep shadow-fleet tankers trading in the Baltic for longer.",
    `We keep the 30-day odds of a deadly or deliberate incident at highly unlikely (${nextOdds}%). Strategic indicators remain dormant: there is no sign of Russian units moving toward Finland or the Baltic states, and no change in nuclear posture.`,
  ].join("\n\n");
}

interface DaySpec {
  date: string;
  title: string;
  bottom_line: string;
  dayLine: string;
  extraSources: SourceKey[];
  d1: Omit<Development, "id" | "source_ids" | "verification" | "attribution" | "incident_ids" | "strike_ids"> & { incident_ids?: string[]; attribution?: Development["attribution"] };
  taiwan?: string;
  indicatorWatch?: boolean;
}

/** Drops sources nothing in the brief cites, as a real brief would. */
function citedOnly(d: DraftBrief): DraftBrief {
  const ids = new Set([...sourceRefs(d).map((r) => r.id), ...d.forecast_resolutions.map((r) => r.source_id)]);
  return { ...d, sources: d.sources.filter((s) => ids.has(s.id)) };
}

function synthetic(spec: DaySpec, db: { incidents: Incident[]; strikes: Strike[] }): DraftBrief {
  const { date } = spec;
  const day = DAILY[date]!;
  const sources = [...weekday.sources.map((s) => ({ ...s, accessed_at: `${date}T05:40:00+08:00` })),
    ...spec.extraSources.map((k, i) => source(`s${18 + i}`, k, `${date}T05:40:00+08:00`))];
  const extraIds = spec.extraSources.map((_, i) => `s${18 + i}`);
  const d1: Development = { incident_ids: [], attribution: null, ...spec.d1, id: "d1", strike_ids: [], verification: null, source_ids: extraIds.length >= 2 ? extraIds : [...extraIds, "s7", "s13"] };
  const devs = [d1, ...GENERIC_DEVS];
  return citedOnly({
    ...clone(weekday),
    date,
    window: windowFor(date),
    generated_at: `${date}T06:01:00+08:00`,
    title: spec.title,
    bottom_line: spec.bottom_line,
    bottom_line_source_ids: [d1.source_ids[0]!, "s3"],
    board: {
      ladder: { current_rung: 3, previous_rung: 3, next_rung_odds: odds(day.nextOdds), rationale: "Rung 3 since 5 October, from drone incursions and debris on NATO and Moldovan territory. No deaths and no deliberate strike on European territory in the window." },
      pathways: pathwaysFor(date, db.incidents),
      countries: countriesFor(date, d1.source_ids),
    },
    developments: devs,
    categories: categoriesFor(devs),
    incidents_new: db.incidents.filter((i) => i.added === date && !i.seed),
    incident_updates: [],
    strikes_new: db.strikes.filter((s) => s.added === date).map((s) => (s.id === "STR-2026-0452" ? { ...s, verification: 2 as const, damage: null, updated: null, sources: s.sources.slice(0, 2) } : s)),
    strike_updates: [],
    indicator_changes: spec.indicatorWatch ? [{ id: "ind-airspace-tempo", to: "watch", evidence: "Three airspace incidents in 30 days against a baseline of 1.3 a month.", source_ids: d1.source_ids }] : [],
    indicators_new: [],
    judgement: { text: judgementFor(spec.dayLine, day.nextOdds), change_my_mind: weekday.judgement.change_my_mind, competing_explanations: [] },
    forecasts_new: [],
    forecast_updates: [],
    forecast_resolutions: [],
    assumption_updates: [],
    taiwan: spec.taiwan ?? weekday.taiwan,
    next_72h: [
      { date: addDays(date, 1), event: "EU ambassadors meet on the 20th sanctions package.", why: "A Hungarian veto would delay new shadow-fleet listings." },
      { date: addDays(date, 2), event: "IAEA update on Zaporizhzhia off-site power.", why: "Losing the last line would raise radiological-safety risk." },
    ],
    weekly_outlook: null,
    metrics: [
      { id: "ru_drones_launched", value: day.drones, unit: "count", period: `night before ${date.slice(8)} Oct`, source_ids: ["s3"], note: null },
      { id: "ru_drones_intercepted", value: Math.round(day.drones * 0.83), unit: "count", period: `night before ${date.slice(8)} Oct`, source_ids: ["s3"], note: null },
      { id: "eu_gas_storage_pct", value: 94.6 - (Number(date.slice(8)) - 20) * 0.1, unit: "%", period: "previous day", source_ids: ["s14"], note: null },
    ],
    sources,
  });
}

const SYNTHETIC: DaySpec[] = [
  {
    date: "2026-10-20", title: "SAMPLE — Drone debris lands near Galați; Romania lodges a protest", indicatorWatch: true,
    bottom_line: "The ladder holds at rung 3. Romania's defence ministry confirmed drone fragments near Galați after a Russian attack on Izmail, the third airspace incident in 30 days against a baseline of 1.3 a month. We put the airspace indicator on watch and raise Romania to elevated (3). The 30-day odds of a deadly or deliberate incident stay highly unlikely (10%).",
    dayLine: "Romania confirmed drone fragments near Galați, the third airspace incident in 30 days.",
    extraSources: ["roMod", "digi24Galati"],
    d1: { category: "airspace", importance: "major", headline: "Drone debris found near Galați after a Russian attack on Izmail", summary: "Romania's defence ministry said fragments of a Russian drone fell near Galați overnight while Russia attacked the Ukrainian port of Izmail across the Danube. No one was hurt, and Bucharest summoned the Russian ambassador.", incident_ids: ["INC-2026-0126"], attribution: 3, russian_framing: null },
  },
  {
    date: "2026-10-21", title: "SAMPLE — EU ambassadors open talks on a 20th sanctions package",
    bottom_line: "No new incident in Europe overnight, and the ladder holds at rung 3 from incursions earlier this month. EU ambassadors opened talks on a 20th sanctions package aimed at shadow-fleet tankers and Russian LNG, and Hungary signalled objections. Russia's overnight raid hit Kharkiv and Sumy, far from NATO borders. Spillover odds are unchanged.",
    dayLine: "No new incident was reported in Europe overnight.",
    extraSources: ["kremlinSanctions"],
    d1: { category: "diplomacy", importance: "major", headline: "EU ambassadors open talks on a 20th sanctions package", summary: "EU ambassadors began discussing a 20th package that would list more shadow-fleet tankers and phase out Russian LNG. Hungary said it could not support an LNG ban without an exemption for its oil imports.", russian_framing: "The Kremlin said new sanctions would only harden Russia's position (claim)." },
  },
  {
    date: "2026-10-22", title: "SAMPLE — Smuggling balloons shut Vilnius airport; drones hit the Saratov refinery",
    bottom_line: "Balloons drifting from Belarus forced Vilnius airport to suspend flights for three hours, the fourth airspace incident in 30 days. Ukraine's drones struck the Saratov refinery, which the regional governor acknowledged as an attack on an industrial site. We raise the 30-day odds of a serious airspace incident to unlikely (30%). The ladder holds at rung 3.",
    dayLine: "Smuggling balloons from Belarus closed Vilnius airport for three hours.",
    extraSources: ["ltCrisis", "lrtBalloons"],
    d1: { category: "airspace", importance: "major", headline: "Smuggling balloons from Belarus close Vilnius airport for three hours", summary: "Lithuania's crisis centre said balloons carrying contraband from Belarus forced Vilnius airport to suspend flights for three hours. Officials said they would raise the matter with Minsk.", incident_ids: ["INC-2026-0127"], attribution: 2, russian_framing: null },
  },
  {
    date: "2026-10-24", title: "SAMPLE — Moldova reports a Russian drone over Ocnița",
    bottom_line: "Moldova's defence ministry said a Russian drone crossed its airspace near Ocnița before turning back into Ukraine, the fourth airspace incident this month. We raise Moldova to elevated (3) and the 30-day odds of a deadly or deliberate incident to highly unlikely (15%). Ukraine logged three strikes on Russian military sites. The ladder holds at rung 3.",
    dayLine: "A Russian drone crossed Moldovan airspace near Ocnița.",
    extraSources: ["mdMod", "newsmaker"],
    d1: { category: "airspace", importance: "major", headline: "Russian drone crosses into Moldova near Ocnița", summary: "Moldova's defence ministry said a Russian drone entered its airspace near Ocnița for about ten minutes during an attack on Ukraine's Vinnytsia region, then turned back. Chișinău summoned the Russian ambassador.", incident_ids: ["INC-2026-0128"], attribution: 3, russian_framing: "Russia's embassy called the report unfounded (claim)." },
  },
  {
    date: "2026-10-25", title: "SAMPLE — Wrocław warehouse fire examined for a foreign link",
    bottom_line: "Polish prosecutors opened an investigation into a fire at a logistics warehouse in Wrocław and said they are examining a link to foreign services. It would be the first suspected sabotage case in Poland since July. We raise the 30-day odds of a serious sabotage incident to highly unlikely (15%). The ladder holds at rung 3.",
    dayLine: "Polish prosecutors are examining a foreign link to a warehouse fire in Wrocław.",
    extraSources: ["plProsecutor", "tvn24"],
    d1: { category: "sabotage", importance: "major", headline: "Prosecutors examine a foreign link to a Wrocław warehouse fire", summary: "Poland's National Prosecutor's Office said a fire that destroyed a logistics warehouse in Wrocław is being investigated as possible sabotage, and that a link to foreign services is being examined. No arrests have been made.", incident_ids: ["INC-2026-0129"], attribution: 2, russian_framing: null },
  },
  {
    date: "2026-10-27", title: "SAMPLE — NATO extends Eastern Sentry air patrols through the winter",
    bottom_line: "No new incident in Europe overnight. NATO said Eastern Sentry air-defence patrols over Poland and the Baltic states will continue through the winter, with Dutch and Swedish aircraft rotating in. Russia's overnight raid on Volyn passed close to the Polish border without crossing it. The ladder holds at rung 3, and spillover odds are unchanged.",
    dayLine: "NATO extended its Eastern Sentry air patrols through the winter.",
    extraSources: ["nato", "carnegie"],
    d1: { category: "resolve", importance: "major", headline: "NATO extends Eastern Sentry air patrols through the winter", summary: "NATO said its Eastern Sentry air-defence mission over Poland and the Baltic states will run through the winter, with Dutch F-35s and Swedish Gripens joining the rotation. Analysts said the move signals that allies expect more stray drones.", russian_framing: null },
  },
  {
    date: "2026-10-29", title: "SAMPLE — Drone fragments found near Tulcea; Poland keeps jets on alert",
    bottom_line: "Romanian media reported drone fragments near Tulcea after a Russian attack on Izmail; the defence ministry has not yet confirmed them. If confirmed, it would be the sixth airspace incident in 30 days against a baseline of 1.3 a month. The airspace pathway stays at unlikely (35%) and the ladder at rung 3. Watch for Bucharest's statement today.",
    dayLine: "Romanian media reported drone fragments near Tulcea, not yet confirmed by the defence ministry.",
    extraSources: ["digi24Tulcea", "reutersTulcea"],
    d1: { category: "airspace", importance: "major", headline: "Drone fragments reported near Tulcea after an attack on Izmail", summary: "Romanian media reported drone fragments in a field near Tulcea after a Russian attack on the Ukrainian port of Izmail. The defence ministry said it was examining the debris. No injuries were reported.", incident_ids: ["INC-2026-0132"], attribution: 2, russian_framing: null },
  },
];

function quietDay(date: string, incidents: Incident[]): DraftBrief {
  const q = clone(quiet);
  const day = DAILY[date]!;
  return {
    ...q,
    date,
    window: windowFor(date),
    generated_at: `${date}T05:58:00+08:00`,
    title: "SAMPLE — Quiet night; no new incidents in Europe",
    bottom_line: "A quiet night for spillover. The ladder stays at rung 3 from incursions earlier this month, and no new incident was reported in Europe. Russia launched a smaller raid of 64 drones, none near NATO borders. EU ambassadors continue their talks on the sanctions package.",
    board: { ...q.board, ladder: { ...q.board.ladder, next_rung_odds: odds(day.nextOdds), rationale: "Rung 3 from incursions earlier this month; nothing new in the window." }, pathways: pathwaysFor(date, incidents).map((x) => ({ ...x, rationale: "No change.", source_ids: [] })), countries: countriesFor(date, []) },
    judgement: { ...q.judgement, text: q.judgement.text.replace("unlikely (35%)", "unlikely (30%)").replace("highly unlikely (15%)", "highly unlikely (10%)") },
    next_72h: q.next_72h.map((e, i) => ({ ...e, date: addDays(date, i + 1) })),
    metrics: q.metrics.map((m) => ({ ...m, period: m.id === "brent_usd" ? "previous close" : "night before 23 Oct" })),
    sources: q.sources.map((s) => ({ ...s, accessed_at: `${date}T05:36:00+08:00` })),
  };
}

function publish(d: DraftBrief, incidents: Incident[], publishedAt: string): Brief {
  // A snapshot of what was known on the day: records added by the brief's date (validateAll checks this).
  const counts = pathwayCounts(incidents.filter((i) => i.added <= d.date), d.date);
  return Brief.parse({
    ...d,
    published_at: publishedAt,
    computed: {
      pathways: Object.fromEntries(PATHWAYS.map((x) => [x, { incidents_30d: counts[x].incidents_30d, baseline_monthly: counts[x].baseline_monthly }])),
      word_count: totalWords(d),
      source_count: d.sources.length,
      source_category_count: new Set(d.sources.map((s) => s.category)).size,
    },
  });
}

// ---------------------------------------------------------------------------------------------------

export function buildSiteContent(): void {
  const incidents = [...seedIncidents(), ...octoberIncidents()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const strikeLog = strikes().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const db = { incidents, strikes: strikeLog };

  const drafts: DraftBrief[] = [
    ...SYNTHETIC.map((s) => synthetic(s, db)),
    quietDay("2026-10-23", incidents),
    clone(monday),
    clone(weekday),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const briefs = drafts.map((d, i) => publish(d, incidents, `${d.date}T06:${String(9 + (i % 7)).padStart(2, "0")}:00+08:00`));

  const last = briefs.at(-1)!;
  const base = stateAsOf("2026-10-28", { airspace: 35, airspaceTrend: "flat", airspaceActive: true });
  const state: State = {
    ...base,
    as_of: last.date,
    ladder: { current_rung: last.board.ladder.current_rung, next_rung_odds: last.board.ladder.next_rung_odds },
    pathways: last.board.pathways.map(({ pathway, serious_odds, impact, trend }) => ({ pathway, serious_odds, impact, trend })),
    countries: TIER1.map((c) => ({ country: c, score: scoreOn(last.date, c), since: c === "RO" ? "2026-10-20" : c === "MD" ? "2026-10-24" : base.countries.find((x) => x.country === c)!.since })),
    weekly: { as_of: monday.date, medium_term: { question: monday.weekly_outlook!.medium_term.question, estimate: monday.weekly_outlook!.medium_term.estimate }, long_term: { question: monday.weekly_outlook!.long_term.question, estimate: monday.weekly_outlook!.long_term.estimate } },
  };

  const write = (file: string, value: unknown) => {
    fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
    fs.writeFileSync(path.join(OUT, file), `${JSON.stringify(value, null, 2)}\n`);
  };
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const b of briefs) write(`briefs/${b.date}.json`, b);
  for (const year of [...new Set(incidents.map((i) => i.date.slice(0, 4)))]) {
    write(`incidents/${year}.json`, { schema_version: 1, year: Number(year), incidents: incidents.filter((i) => i.date.startsWith(year)) });
  }
  write("strikes/2026.json", { schema_version: 1, year: 2026, strikes: strikeLog });
  write("state.json", state);
  write("forecasts.json", { schema_version: 1, forecasts: forecasts() });
  write("corrections.json", { schema_version: 1, corrections: [{ id: "C-0001", date: "2026-10-25", target: { kind: "brief", id: "2026-10-24" }, description: "The 24 October brief first named the wrong district for the Moldovan incursion; it was Ocnița." }] });
  const archived = weekday.sources.slice(0, 2).map((s) => s.url);
  write("archive-index.json", { schema_version: 1, urls: Object.fromEntries(archived.map((u) => [normalizeUrl(u), { snapshot: `https://web.archive.org/web/20261028063000/${u}`, at: "2026-10-28T06:30:00+08:00" }])) });

  const r = validateAll(OUT);
  if (!r.ok) {
    console.error(`${OUT} does not validate:`);
    for (const e of r.errors.slice(0, 40)) console.error(`  ${e.code} ${e.path}: ${e.message}`);
    process.exit(1);
  }
  console.log(`Wrote ${OUT}: ${briefs.length} briefs, ${incidents.length} incidents, ${strikeLog.length} strikes (${r.warnings.length} warnings).`);
}
