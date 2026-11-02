// SAMPLE drafts for the validator fixtures: a weekday, a Monday with the weekly outlook, and a quiet day.
// Invented content; see world.ts.

import type { DraftBrief } from "../../lib/schema/draft-brief";
import { NO_CHANGE_TEXT, TAIWAN_NO_NEWS, type CategoryId } from "../../lib/vocab";
import { evidenceSource, p, source, type SourceKey } from "./world";

const noChange = (category: CategoryId) => ({ category, status: "no_change" as const, text: NO_CHANGE_TEXT, development_ids: [], source_ids: [] });
const material = (category: CategoryId, text: string, development_ids: string[], source_ids: string[]) =>
  ({ category, status: "material" as const, text, development_ids, source_ids });

function sources(accessed: string, keys: SourceKey[]) {
  return keys.map((k, i) => source(`s${i + 1}`, k, accessed));
}

// ---------------------------------------------------------------------------------------------------
// Weekday: Wednesday 28 October 2026

// s1 dorsz, s2 nfp, s3 uaAir, s4 ruMod, s5 krasnodar, s6 firms, s7 reutersEu, s8 yle, s9 krp, s10 isw,
// s11 tass, s12 iaea, s13 kyivind, s14 market, s15 rusi, s16 bloomberg, s17 uaGs
const WEEKDAY_SOURCES: SourceKey[] = ["dorsz", "nfp", "uaAir", "ruMod", "krasnodar", "firms", "reutersEu", "yle", "krp", "isw", "tass", "iaea", "kyivind", "market", "rusi", "bloomberg", "uaGs"];

export const weekday: DraftBrief = {
  schema_version: 1,
  date: "2026-10-28",
  window: { start: "2026-10-27T05:30:00+08:00", end: "2026-10-28T05:30:00+08:00" },
  generated_at: "2026-10-28T06:02:00+08:00",
  quiet_day: false,
  weekly: false,
  title: "SAMPLE — Russian drone crosses into Poland; Novorossiysk oil terminal struck",
  bottom_line: "The ladder stays at rung 3, overt military incidents without deaths. A Russian drone crossed into Lublin Voivodeship during an overnight attack on Volyn and was shot down, the fifth airspace incident in 30 days against a baseline of 1.3 a month. We raise the 30-day odds of a serious airspace incident to unlikely (35%). Ukraine struck the Sheskharis oil terminal at Novorossiysk; fires are geolocated but damage is unconfirmed. Watch Thursday's meeting of EU ambassadors on the stalled sanctions package.",
  bottom_line_source_ids: ["s1", "s17"],
  board: {
    ladder: {
      current_rung: 3,
      previous_rung: 3,
      next_rung_odds: p(15, "highly_unlikely", "moderate"),
      rationale: "Rung 3 since 5 October: Russian drones in Polish and Moldovan airspace and debris in Romania. No deaths and no deliberate strike on European territory in the window.",
    },
    pathways: [
      { pathway: "airspace", serious_odds: p(35, "unlikely", "moderate"), impact: 3, trend: "up", rationale: "Five incidents in 30 days against 1.3 a month at baseline; strikes on Volyn now route drones close to the Polish border.", source_ids: ["s1", "s3"] },
      { pathway: "sabotage", serious_odds: p(15, "highly_unlikely", "moderate"), impact: 3, trend: "flat", rationale: "One incident in 30 days against a baseline of 1.7 a month; no new arrests in the window.", source_ids: [] },
      { pathway: "maritime", serious_odds: p(15, "highly_unlikely", "low"), impact: 3, trend: "flat", rationale: "Finland raised the cable case to attributed; the base rate is unchanged at about one incident a month.", source_ids: ["s9"] },
      { pathway: "cyber_ew", serious_odds: p(10, "highly_unlikely", "moderate"), impact: 2, trend: "flat", rationale: "Jamming continues at background levels; no essential service was disrupted for over a day in 12 months.", source_ids: [] },
      { pathway: "military_pressure", serious_odds: p(5, "remote", "moderate"), impact: 5, trend: "flat", rationale: "The Belarusian snap check ended on schedule; no redeployment toward NATO borders observed.", source_ids: ["s10"] },
      { pathway: "nuclear", serious_odds: p(5, "remote", "high"), impact: 5, trend: "flat", rationale: "Zaporizhzhia is on one off-site line; no change in Russian nuclear posture.", source_ids: ["s12"] },
      { pathway: "political_economic", serious_odds: p(10, "highly_unlikely", "low"), impact: 3, trend: "flat", rationale: "Hungary's veto threat delays sanctions but blocks no NATO decision.", source_ids: ["s7"] },
    ],
    countries: [
      { country: "PL", score: 3, previous_score: 3, reason: "Rung-3 drone incursion in Lublin Voivodeship on 27 October.", source_ids: ["s1"], indicator_ids: [], cohesion_flag: false },
      { country: "LT", score: 2, previous_score: 2, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "LV", score: 2, previous_score: 2, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "EE", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "FI", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "RO", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "MD", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "HU", score: 1, previous_score: null, reason: "Budapest repeated its veto threat on the 20th sanctions package.", source_ids: ["s7"], indicator_ids: [], cohesion_flag: true },
    ],
  },
  developments: [
    {
      id: "d1", headline: "Russian drone shot down over Lublin Voivodeship during attack on Volyn",
      summary: "Poland's Operational Command said a Russian Geran-type drone crossed from Ukraine at 23:40 Kyiv time and was shot down near Hrubieszów. Debris fell in a field and nobody was hurt. Poland scrambled aircraft and closed Rzeszów airport for 90 minutes.",
      category: "airspace", importance: "major", incident_ids: ["INC-2026-0131"], strike_ids: [], verification: null, attribution: 3,
      russian_framing: "Russia's defence ministry said it struck only military targets in Volyn and called the Polish account a provocation (claim).",
      source_ids: ["s1", "s2", "s4"],
    },
    {
      id: "d2", headline: "Ukrainian drones hit the Sheskharis oil terminal at Novorossiysk",
      summary: "Ukraine's General Staff said long-range drones struck the Sheskharis terminal, Russia's largest Black Sea crude export outlet. Krasnodar's operational headquarters reported a fire at the port after debris fell. Satellite fire detections confirm a blaze at the terminal; loading status is unconfirmed.",
      category: "deep_strikes", importance: "major", incident_ids: [], strike_ids: ["STR-2026-0457"], verification: 3, attribution: null,
      russian_framing: "Krasnodar officials said air defences destroyed most drones and that falling debris caused the fire (claim).",
      source_ids: ["s17", "s5", "s6"],
    },
    {
      id: "d3", headline: "Finland links Gulf of Finland cable damage to a Russia-bound tanker",
      summary: "Finnish police said evidence ties the 16 October damage to a Finland–Estonia data cable to the anchor of a tanker bound for Ust-Luga, which they describe as part of Russia's shadow fleet. The case is now investigated as aggravated criminal mischief.",
      category: "maritime", importance: "notable", incident_ids: ["INC-2026-0124"], strike_ids: [], verification: null, attribution: 3,
      russian_framing: null,
      source_ids: ["s8", "s9"],
    },
    {
      id: "d4", headline: "EU sanctions package stalls again over Hungarian objections",
      summary: "EU ambassadors failed for a third time to agree the 20th sanctions package, which would list more shadow-fleet tankers and phase out Russian LNG imports. Hungary asked for an exemption for oil delivered through the Druzhba pipeline.",
      category: "diplomacy", importance: "notable", incident_ids: [], strike_ids: [], verification: null, attribution: null,
      russian_framing: null,
      source_ids: ["s7", "s13"],
    },
  ],
  categories: [
    material("battlefield", "DeepState recorded Russian gains of about 18 km² near Pokrovsk and Huliaipole. No collapse or breakthrough is in sight.", [], ["s10"]),
    material("deep_strikes", "The Sheskharis strike (d2) is the third Ukrainian strike on Black Sea oil export infrastructure this month.", ["d2"], ["s17", "s6"]),
    material("russian_strikes", "Russia launched 142 drones and 3 missiles overnight, mostly at the Volyn and Lviv regions near the Polish border; 118 drones were downed.", ["d1"], ["s3", "s11"]),
    material("diplomacy", "The sanctions package is stuck on Hungary's Druzhba demand (d4). No date is set for the next round of US-brokered talks.", ["d4"], ["s7", "s13"]),
    material("airspace", "One incursion into Poland (d1). Polish and Romanian aircraft were scrambled as Russian strikes approached their borders.", ["d1"], ["s1", "s2"]),
    noChange("sabotage"),
    material("maritime", "Finland upgraded the cable case (d3); no new incidents in the window.", ["d3"], ["s9"]),
    noChange("cyber_ew"),
    noChange("military_pressure"),
    material("nuclear", "The IAEA said Zaporizhzhia remains on a single 750 kV line after repairs to the backup line were postponed.", [], ["s12"]),
    noChange("political_economic"),
    material("resolve", "Germany pledged two more Patriot systems for Ukraine, and NATO's Eastern Sentry added Dutch F-35s in Poland.", [], ["s15"]),
  ],
  incidents_new: [{
    id: "INC-2026-0131", date: "2026-10-27", date_precision: "day", location_country: "PL", affected: ["PL"], location: "Lublin Voivodeship", sea: null,
    pathway: "airspace", type: "drone_incursion", rung: 3, serious: false,
    summary: "Poland's Operational Command said a Russian Geran-type drone crossed from Ukraine during an attack on Volyn and was shot down near Hrubieszów. Debris fell in a field; no injuries. Rzeszów airport closed for 90 minutes.",
    attribution: 3, attribution_note: "Polish Operational Command identified the drone as a Russian Geran-2.", host_statement: "yes",
    casualties: { killed: 0, injured: 0 }, disruption_hours: 1.5,
    sources: [evidenceSource("dorsz"), evidenceSource("nfp")],
    seed: false, added: "2026-10-28", updated: null,
  }],
  incident_updates: [{
    id: "INC-2026-0124",
    changes: { attribution: 3, attribution_note: "Finnish police tied the damage to the anchor of a shadow-fleet tanker bound for Ust-Luga.", rung: null, serious: null, casualties: null, disruption_hours: null, summary: null },
    add_sources: [evidenceSource("krp")],
    reason: "Finnish police published findings linking the damage to a Russia-bound shadow-fleet tanker.",
  }],
  strikes_new: [{
    id: "STR-2026-0457", date: "2026-10-27", target_name: "Sheskharis oil terminal, Novorossiysk", target_type: "oil_terminal", region: "Krasnodar Krai",
    occupied_territory: false, lat: 44.7, lon: 37.8, distance_km: 380, weapon: "drone", weapon_detail: "Liutyi long-range drones", western_weapon: null,
    verification: 3, damage: null, effect: null,
    summary: "Ukraine's General Staff claimed a strike on Russia's main Black Sea crude terminal. Krasnodar officials reported a fire after debris fell, and satellite fire detections confirm a blaze at the terminal.",
    sources: [evidenceSource("uaGs"), evidenceSource("krasnodar"), evidenceSource("firms")],
    seed: false, added: "2026-10-28", updated: null,
  }],
  strike_updates: [{
    id: "STR-2026-0452",
    changes: { verification: 4, damage: "Satellite images show two burned distillation columns at the refinery.", effect: null, summary: null, weapon_detail: null, western_weapon: null },
    add_sources: [evidenceSource("bloomberg")],
    reason: "Commercial satellite images published by Bloomberg confirm the damage.",
  }],
  indicator_changes: [{ id: "ind-airspace-tempo", to: "active", evidence: "Five airspace incidents in 30 days against a 90-day baseline of 1.3 a month.", source_ids: ["s1", "s2"] }],
  indicators_new: [],
  judgement: {
    text: "We assess that the Polish incursion fits the pattern of the past month. Russian drone routes to Volyn and Lviv now pass within a few kilometres of the Polish border, and the number of strays has grown with the size of the raids. Five airspace incidents in 30 days is almost four times the baseline of 1.3 a month, so we raise the 30-day odds of a serious airspace incident from 30% to unlikely (35%). We see no sign that the incursions are deliberate probes of Polish air defences: the drones flew on strike headings and none loitered over Polish territory.\n\nThe Sheskharis strike matters for spillover mainly through Russia's response. Moscow frames strikes on its export terminals as Western-enabled, and officials have threatened consequences for countries that supply long-range targeting. We see no change yet in Russian posture toward NATO, and the Belarusian snap check ended on schedule.\n\nThe Finnish cable finding raises attribution but not risk: undersea incidents remain at about one a month, and most cases have ended without charges. The sanctions deadlock is a cohesion problem rather than a spillover driver for now. Overall the ladder stays at rung 3, and a deadly or deliberate incident within 30 days remains highly unlikely (15%).",
    change_my_mind: "Drones crossing on headings toward Polish military sites, or a Russian statement naming Poland's air defences as a target, would make us treat the incursions as deliberate.",
    competing_explanations: [{
      subject: "INC-2026-0131: drone over Lublin Voivodeship",
      hypotheses: [
        { label: "Stray drone on a strike route to Volyn", assessment: "The track ran straight from the Volyn strike corridor, and October's earlier strays followed the same path.", estimate: p(70, "likely", "moderate") },
        { label: "Deliberate probe of Polish air defences", assessment: "Russia has an interest in testing response times, but the drone neither loitered nor changed heading.", estimate: p(30, "unlikely", "moderate") },
      ],
    }],
  },
  forecasts_new: [{
    id: "F-2026-014",
    question: "Will a Russian drone or missile enter Polish airspace between 29 October and 27 November 2026?",
    resolution_criteria: "Polish Operational Command or the defence ministry confirms at least one Russian drone or missile in Polish airspace in the period.",
    resolves_by: "2026-11-27", horizon: "30d", pathway: "airspace", probability: 75, base_rate: 60,
    base_rate_note: "Polish airspace saw at least one incursion in 7 of the last 12 months.",
  }],
  forecast_updates: [{ id: "F-2026-011", probability: 12, note: "Another incursion raises the chance that Poland requests Article 4 consultations." }],
  forecast_resolutions: [],
  assumption_updates: [{ op: "reaffirm", id: "A3", text: null, reason: "The Polish incursion followed a strike route, consistent with spillover rather than preparation for an attack." }],
  taiwan: "Each Russian raid near the Polish border adds to European demand for Patriot and NASAMS interceptors, the same systems Taiwan is waiting for. Germany's latest Patriot pledge draws on production slots that compete with Taiwan's 2027 deliveries. The Novorossiysk strike is another data point for Taiwan's planners on long-range drones against coastal energy infrastructure, relevant both to defending Taiwan's LNG terminals and to holding Chinese ports at risk.",
  next_72h: [
    { date: "2026-10-29", event: "EU ambassadors meet again on the 20th sanctions package.", why: "A Hungarian veto would delay new shadow-fleet listings." },
    { date: "2026-10-30", event: "IAEA briefing on Zaporizhzhia off-site power.", why: "Losing the last line would raise radiological-safety risk." },
    { date: "2026-10-31", event: "Belarusian defence ministry briefing on autumn exercises.", why: "Shows whether forces stay near the Polish and Lithuanian borders." },
  ],
  weekly_outlook: null,
  metrics: [
    { id: "ru_drones_launched", value: 142, unit: "count", period: "night of 27–28 Oct", source_ids: ["s3"], note: null },
    { id: "ru_drones_intercepted", value: 118, unit: "count", period: "night of 27–28 Oct", source_ids: ["s3"], note: "Includes drones lost to electronic warfare." },
    { id: "ru_missiles_launched", value: 3, unit: "count", period: "night of 27–28 Oct", source_ids: ["s3"], note: null },
    { id: "ua_deep_strikes", value: 1, unit: "count", period: "27 Oct", source_ids: ["s17"], note: null },
    { id: "eu_gas_storage_pct", value: 94.1, unit: "%", period: "26 Oct", source_ids: ["s14"], note: null },
    { id: "brent_usd", value: 66.4, unit: "USD/bbl", period: "27 Oct close", source_ids: ["s14"], note: null },
    { id: "gnss_interference_index", value: null, unit: "%", period: "27 Oct", source_ids: [], note: "No daily figure published." },
    { id: "znpp_offsite_power_lines", value: 1, unit: "count", period: "27 Oct", source_ids: ["s12"], note: null },
  ],
  sources: sources("2026-10-28T05:41:00+08:00", WEEKDAY_SOURCES),
};

// ---------------------------------------------------------------------------------------------------
// Monday: 26 October 2026, with the weekly outlook

// s1 uaGsKlintsy, s2 bryansk, s3 reutersSummit, s4 belta, s5 lrt, s6 nato, s7 bnd, s8 carnegie, s9 isw,
// s10 kyivind, s11 tass, s12 market, s13 uaAir
const MONDAY_SOURCES: SourceKey[] = ["uaGsKlintsy", "bryansk", "reutersSummit", "belta", "lrt", "nato", "bnd", "carnegie", "isw", "kyivind", "tass", "market", "uaAir"];

export const monday: DraftBrief = {
  schema_version: 1,
  date: "2026-10-26",
  window: { start: "2026-10-25T05:30:00+08:00", end: "2026-10-26T05:30:00+08:00" },
  generated_at: "2026-10-26T06:05:00+08:00",
  quiet_day: false,
  weekly: true,
  title: "SAMPLE — Weekly outlook: spillover risk steady at rung 3; EU misses sanctions deadline",
  bottom_line: "The ladder holds at rung 3 for a third week, driven by drone incursions in Poland and Moldova and debris in Romania. Belarus ended its snap readiness check near Grodno on schedule. Ukraine struck an ammunition depot near Klintsy, which the Bryansk governor acknowledged. EU leaders missed their 25 October target for the 20th sanctions package. The 6-to-12-month risk of a deliberate Russian attack on NATO stays highly unlikely (10%).",
  bottom_line_source_ids: ["s4", "s3"],
  board: {
    ladder: {
      current_rung: 3,
      previous_rung: 3,
      next_rung_odds: p(15, "highly_unlikely", "moderate"),
      rationale: "Rung 3 since 5 October from incursions in Poland and Moldova and debris in Romania; no deaths or deliberate strikes on European territory.",
    },
    pathways: [
      { pathway: "airspace", serious_odds: p(30, "unlikely", "moderate"), impact: 3, trend: "flat", rationale: "Four incidents in 30 days against 1.3 a month; no incursion in the window.", source_ids: [] },
      { pathway: "sabotage", serious_odds: p(15, "highly_unlikely", "moderate"), impact: 3, trend: "flat", rationale: "One incident in 30 days, below the baseline of 1.7 a month.", source_ids: [] },
      { pathway: "maritime", serious_odds: p(15, "highly_unlikely", "low"), impact: 3, trend: "flat", rationale: "One cable incident in 30 days, at the baseline.", source_ids: [] },
      { pathway: "cyber_ew", serious_odds: p(10, "highly_unlikely", "moderate"), impact: 2, trend: "flat", rationale: "Background jamming only; no service disruption.", source_ids: [] },
      { pathway: "military_pressure", serious_odds: p(5, "remote", "moderate"), impact: 5, trend: "flat", rationale: "The Belarusian check ended on schedule and troops returned to garrison.", source_ids: ["s4", "s5"] },
      { pathway: "nuclear", serious_odds: p(5, "remote", "high"), impact: 5, trend: "flat", rationale: "No change in posture or plant safety.", source_ids: [] },
      { pathway: "political_economic", serious_odds: p(10, "highly_unlikely", "low"), impact: 3, trend: "flat", rationale: "The missed sanctions deadline delays, but does not block, an EU decision.", source_ids: ["s3"] },
    ],
    countries: [
      { country: "PL", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "LT", score: 2, previous_score: 2, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "LV", score: 2, previous_score: 2, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "EE", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "FI", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "RO", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "MD", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
    ],
  },
  developments: [
    {
      id: "d1", headline: "Belarus ends snap readiness check near Grodno",
      summary: "Belarus's defence ministry said the snap check of about 3,000 troops near Grodno ended on schedule and units returned to their garrisons. Lithuanian officials said they saw no movement toward the border during the exercise.",
      category: "military_pressure", importance: "notable", incident_ids: ["INC-2026-0130"], strike_ids: [], verification: null, attribution: 4,
      russian_framing: null, source_ids: ["s4", "s5"],
    },
    {
      id: "d2", headline: "Ukraine strikes ammunition depot near Klintsy in Bryansk Oblast",
      summary: "Ukraine's General Staff said drones hit an ammunition depot near Klintsy, about 60 km from the border. The Bryansk governor reported a drone attack on the district and a fire at a military site.",
      category: "deep_strikes", importance: "major", incident_ids: [], strike_ids: ["STR-2026-0456"], verification: 2, attribution: null,
      russian_framing: "The governor said air defences shot down most of the drones (claim).", source_ids: ["s1", "s2"],
    },
    {
      id: "d3", headline: "EU leaders miss their 25 October deadline for the 20th sanctions package",
      summary: "EU leaders ended their summit without adopting the 20th sanctions package after Hungary and Slovakia sought energy exemptions. Diplomats expect a new attempt in November.",
      category: "diplomacy", importance: "major", incident_ids: [], strike_ids: [], verification: null, attribution: null,
      russian_framing: "TASS said the delay showed European unity was fraying (claim).", source_ids: ["s3", "s10", "s11"],
    },
  ],
  categories: [
    material("battlefield", "ISW reports slow Russian gains near Pokrovsk with no sign of operational breakthrough.", [], ["s9"]),
    material("deep_strikes", "Klintsy depot strike (d2), acknowledged by the Bryansk governor.", ["d2"], ["s1", "s2"]),
    material("russian_strikes", "Russia launched 97 drones overnight, mostly at Kharkiv and Sumy, away from NATO borders.", [], ["s13"]),
    material("diplomacy", "EU leaders missed the sanctions deadline (d3).", ["d3"], ["s3"]),
    noChange("airspace"),
    noChange("sabotage"),
    noChange("maritime"),
    noChange("cyber_ew"),
    material("military_pressure", "Belarus ended its snap check on schedule (d1). Estonia's intelligence service said rebuilding in the Leningrad Military District is early-stage.", ["d1"], ["s4", "s5", "s7"]),
    noChange("nuclear"),
    material("political_economic", "Hungary and Slovakia tied sanctions support to energy exemptions.", ["d3"], ["s3", "s10"]),
    material("resolve", "NATO said Eastern Sentry patrols will continue through the winter, as Carnegie analysts describe Russia rebuilding its northern forces.", [], ["s6", "s8"]),
  ],
  incidents_new: [],
  incident_updates: [],
  strikes_new: [{
    id: "STR-2026-0456", date: "2026-10-25", target_name: "Ammunition depot near Klintsy", target_type: "ammunition_depot", region: "Bryansk Oblast",
    occupied_territory: false, lat: null, lon: null, distance_km: 60, weapon: "drone", weapon_detail: null, western_weapon: null,
    verification: 2, damage: null, effect: null,
    summary: "Ukraine's General Staff claimed a strike on an ammunition depot near Klintsy. The Bryansk governor reported a drone attack on the district and a fire at a military site.",
    sources: [evidenceSource("uaGsKlintsy"), evidenceSource("bryansk")],
    seed: false, added: "2026-10-26", updated: null,
  }],
  strike_updates: [],
  indicator_changes: [],
  indicators_new: [],
  judgement: {
    text: "We assess that spillover risk is steady. The ladder has been at rung 3 for three weeks because of stray drones and debris from Russian strikes near the Polish, Moldovan and Romanian borders, not because of deliberate action. The Belarusian snap check near Grodno was the week's main posture signal; it ended on schedule and Lithuanian monitoring saw no movement toward the border, so the military-pressure pathway stays remote (5%).\n\nThe missed sanctions deadline matters more for cohesion than for incidents. Hungary and Slovakia used the package to seek energy exemptions, as they did with earlier packages, and both eventually signed. We expect adoption in November, but the delay keeps shadow-fleet tankers off the list for longer, which bears on the maritime pathway in the Baltic.\n\nUkraine's strikes inside Russia continue at about four a week, and Russia has not answered them with steps against European suppliers beyond rhetoric. We keep the 30-day odds of a deadly or deliberate incident at highly unlikely (15%).",
    change_my_mind: "A Russian unit moving from Ukraine toward Finland or the Baltics, or a sabotage attack causing deaths, would raise the medium-term outlook.",
    competing_explanations: [],
  },
  forecasts_new: [{
    id: "F-2026-013",
    question: "Will the EU adopt its 20th sanctions package against Russia by 30 November 2026?",
    resolution_criteria: "The Council of the EU announces adoption of the 20th package on or before 30 November 2026.",
    resolves_by: "2026-11-30", horizon: "30d", pathway: "political_economic", probability: 65, base_rate: 70,
    base_rate_note: "Earlier packages blocked at a summit were usually adopted within five weeks.",
  }],
  forecast_updates: [],
  forecast_resolutions: [{ id: "F-2026-005", outcome: "no", note: "EU leaders ended the summit without adopting the 20th package.", source_id: "s3" }],
  assumption_updates: [],
  taiwan: "The sanctions delay shows how a single member state can slow the EU's response to Russia, a precedent Beijing watches when it weighs Europe's likely reaction to pressure on Taiwan. Ukraine's steady deep-strike campaign also keeps European interceptor stocks tight, which delays deliveries Taiwan is waiting for.",
  next_72h: [
    { date: "2026-10-27", event: "Belarus's defence ministry publishes its autumn exercise plan.", why: "Shows whether more drills are planned near Poland and Lithuania." },
    { date: "2026-10-28", event: "EU ambassadors resume talks on the sanctions package.", why: "A deal would add shadow-fleet tankers to the list." },
  ],
  weekly_outlook: {
    medium_term: {
      question: "Will Russia conduct a deliberate, attributable armed attack on NATO territory in the next 12 months?",
      estimate: p(10, "highly_unlikely", "low"),
      text: "We assess a deliberate attack in the next year as highly unlikely (10%). Russia's main force remains committed in Ukraine, and the Estonian service's latest briefing describes rebuilding in the Leningrad Military District as early-stage. The risk would rise quickly after a ceasefire that freed forces, which is why we track redeployment and mobilisation as strategic indicators. Today none of them is active.",
    },
    long_term: {
      question: "Will Russia and a NATO member be in direct armed conflict by the end of 2030?",
      estimate: p(20, "highly_unlikely", "low"),
      text: "Several European services judge that Russia could be ready for a limited war with NATO within three to five years of a ceasefire. We weigh that capability estimate against intent, US commitment and European rearmament, and assess direct conflict by 2030 as highly unlikely (20%), with low confidence because the main drivers are political.",
    },
    assumptions_check: [
      { id: "A1", status: "holds", note: "No deliberate attack on NATO territory; incursions remain strays." },
      { id: "A2", status: "holds", note: "US officials reaffirmed Article 5 at the NATO ministerial." },
      { id: "A3", status: "holds", note: "This month's incursions followed strike routes." },
      { id: "A4", status: "holds", note: "Sabotage and cable incidents continued regardless of diplomacy." },
      { id: "A5", status: "holds", note: "No ceasefire yet; reconstitution in the north is early-stage." },
    ],
    calibration_note: "One forecast resolved this week (F-2026-005, no). Four forecasts have resolved since August, with a mean Brier score of 0.11 against 0.16 for the base-rate forecaster. That is too few to judge calibration.",
  },
  metrics: [
    { id: "ru_drones_launched", value: 97, unit: "count", period: "night of 25–26 Oct", source_ids: ["s13"], note: null },
    { id: "ua_deep_strikes", value: 1, unit: "count", period: "25 Oct", source_ids: ["s1"], note: null },
    { id: "eu_gas_storage_pct", value: 94.3, unit: "%", period: "24 Oct", source_ids: ["s12"], note: null },
  ],
  sources: sources("2026-10-26T05:44:00+08:00", MONDAY_SOURCES),
};

// ---------------------------------------------------------------------------------------------------
// Quiet day: Thursday 29 October 2026

// s1 uaAir, s2 dorsz, s3 reutersEu, s4 isw, s5 market
const QUIET_SOURCES: SourceKey[] = ["uaAir", "dorsz", "reutersEu", "isw", "market"];

export const quiet: DraftBrief = {
  schema_version: 1,
  date: "2026-10-29",
  window: { start: "2026-10-28T05:30:00+08:00", end: "2026-10-29T05:30:00+08:00" },
  generated_at: "2026-10-29T05:58:00+08:00",
  quiet_day: true,
  weekly: false,
  title: "SAMPLE — Quiet night; EU sanctions talks resume",
  bottom_line: "A quiet night for spillover. The ladder stays at rung 3 from the 27 October drone incursion into Poland, and no new incident was reported in Europe. Russia launched a smaller raid of 64 drones, none near NATO borders. EU ambassadors resume talks on the sanctions package today.",
  bottom_line_source_ids: ["s1", "s2"],
  board: {
    ladder: {
      current_rung: 3,
      previous_rung: 3,
      next_rung_odds: p(15, "highly_unlikely", "moderate"),
      rationale: "Rung 3 from the 27 October incursion into Poland; nothing new in the window.",
    },
    pathways: [
      { pathway: "airspace", serious_odds: p(35, "unlikely", "moderate"), impact: 3, trend: "flat", rationale: "No incursion in the window; five in 30 days.", source_ids: [] },
      { pathway: "sabotage", serious_odds: p(15, "highly_unlikely", "moderate"), impact: 3, trend: "flat", rationale: "No change.", source_ids: [] },
      { pathway: "maritime", serious_odds: p(15, "highly_unlikely", "low"), impact: 3, trend: "flat", rationale: "No change.", source_ids: [] },
      { pathway: "cyber_ew", serious_odds: p(10, "highly_unlikely", "moderate"), impact: 2, trend: "flat", rationale: "No change.", source_ids: [] },
      { pathway: "military_pressure", serious_odds: p(5, "remote", "moderate"), impact: 5, trend: "flat", rationale: "No change.", source_ids: [] },
      { pathway: "nuclear", serious_odds: p(5, "remote", "high"), impact: 5, trend: "flat", rationale: "No change.", source_ids: [] },
      { pathway: "political_economic", serious_odds: p(10, "highly_unlikely", "low"), impact: 3, trend: "flat", rationale: "No change.", source_ids: [] },
    ],
    countries: [
      { country: "PL", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "LT", score: 2, previous_score: 2, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "LV", score: 2, previous_score: 2, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "EE", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "FI", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "RO", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
      { country: "MD", score: 3, previous_score: 3, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false },
    ],
  },
  developments: [{
    id: "d1", headline: "Russia launches a smaller overnight raid away from NATO borders",
    summary: "Ukraine's Air Force said Russia launched 64 drones overnight, mostly at Kharkiv and Dnipro, and that 51 were shot down or suppressed. None approached the Polish, Romanian or Moldovan borders.",
    category: "russian_strikes", importance: "notable", incident_ids: [], strike_ids: [], verification: null, attribution: null,
    russian_framing: null, source_ids: ["s1"],
  }],
  categories: [
    material("battlefield", "ISW reports no significant change on the main axes.", [], ["s4"]),
    noChange("deep_strikes"),
    material("russian_strikes", "A smaller raid of 64 drones, far from NATO borders (d1).", ["d1"], ["s1"]),
    material("diplomacy", "EU ambassadors resume talks on the sanctions package today.", [], ["s3"]),
    noChange("airspace"),
    noChange("sabotage"),
    noChange("maritime"),
    noChange("cyber_ew"),
    noChange("military_pressure"),
    noChange("nuclear"),
    noChange("political_economic"),
    noChange("resolve"),
  ],
  incidents_new: [],
  incident_updates: [],
  strikes_new: [],
  strike_updates: [],
  indicator_changes: [],
  indicators_new: [],
  judgement: {
    text: "We assess no change in spillover risk. The night's raid was smaller than recent ones and aimed at eastern Ukraine, so the Polish border saw no stray drones. The airspace pathway stays at unlikely (35%) because the 30-day count is still well above the baseline, and Polish Operational Command kept aircraft on alert overnight. Nothing in the window changes the standing assumptions or the 30-day odds of a deadly or deliberate incident, which remain highly unlikely (15%).",
    change_my_mind: "A renewed large raid on Volyn or Lviv would put the Polish border back at risk within days.",
    competing_explanations: [],
  },
  forecasts_new: [],
  forecast_updates: [],
  forecast_resolutions: [],
  assumption_updates: [],
  taiwan: TAIWAN_NO_NEWS,
  next_72h: [
    { date: "2026-10-30", event: "IAEA briefing on Zaporizhzhia off-site power.", why: "Losing the last line would raise radiological-safety risk." },
    { date: "2026-10-31", event: "Belarusian defence ministry briefing on autumn exercises.", why: "Shows whether forces stay near the Polish and Lithuanian borders." },
  ],
  weekly_outlook: null,
  metrics: [
    { id: "ru_drones_launched", value: 64, unit: "count", period: "night of 28–29 Oct", source_ids: ["s1"], note: null },
    { id: "ru_drones_intercepted", value: 51, unit: "count", period: "night of 28–29 Oct", source_ids: ["s1"], note: null },
    { id: "brent_usd", value: 65.9, unit: "USD/bbl", period: "28 Oct close", source_ids: ["s5"], note: null },
  ],
  sources: sources("2026-10-29T05:36:00+08:00", QUIET_SOURCES),
};
