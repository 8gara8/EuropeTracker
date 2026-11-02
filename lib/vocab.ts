// Every controlled vocabulary, label and definition (SPEC §4.2). The methodology page renders from
// these, and routine/STYLE.md must agree with them; if the two differ, this file wins.

export const PATHWAYS = ["airspace", "sabotage", "maritime", "cyber_ew", "military_pressure",
  "nuclear", "political_economic"] as const;
export type PathwayId = (typeof PATHWAYS)[number];

export const DRIVERS = ["battlefield", "deep_strikes", "russian_strikes", "diplomacy"] as const;
export const CATEGORIES = [...DRIVERS, ...PATHWAYS, "resolve"] as const; // 12, in display order
export type CategoryId = (typeof CATEGORIES)[number];

export const CATEGORY_INFO: Record<CategoryId, { label: string; group: "Drivers" | "Pathways" | "Brakes"; covers: string }> = {
  battlefield:        { label: "Battlefield trajectory", group: "Drivers", covers: "Who is gaining, how fast, and whether a collapse or breakthrough is in sight" },
  deep_strikes:       { label: "Deep strikes and long-range escalation", group: "Drivers", covers: "Ukraine's strikes into Russia, Western long-range weapons, Russian threats against suppliers" },
  russian_strikes:    { label: "Russian strike campaign, especially near NATO borders", group: "Drivers", covers: "Drones and missiles launched and intercepted; western Ukraine, Odesa and the Danube" },
  diplomacy:          { label: "Ceasefire and diplomacy", group: "Drivers", covers: "Talks, proposals, guarantees, sanctions packages, frozen assets" },
  airspace:           { label: "Airspace incursions and stray munitions", group: "Pathways", covers: "Drones, missiles, aircraft or debris crossing into European airspace or territory" },
  sabotage:           { label: "Sabotage and covert action", group: "Pathways", covers: "Arson, explosives, rail attacks, assassination plots, recruited proxies" },
  maritime:           { label: "Maritime and undersea infrastructure", group: "Pathways", covers: "Cables, pipelines, shadow fleet, naval confrontations in the Baltic, Black and North Seas" },
  cyber_ew:           { label: "Cyber and electronic warfare", group: "Pathways", covers: "GPS jamming and spoofing; attacks on grids, rail, telecoms, hospitals, elections" },
  military_pressure:  { label: "Russian military posture toward NATO", group: "Pathways", covers: "Build-ups, exercises, probes near the Baltics, Finland, Suwałki; Belarus and Kaliningrad" },
  nuclear:            { label: "Nuclear signalling and radiological safety", group: "Pathways", covers: "Doctrine, exercises, deployments; Zaporizhzhia, Chornobyl and other plants" },
  political_economic: { label: "Political, economic and migration pressure", group: "Pathways", covers: "Election interference, energy coercion, migration used as a weapon, influence networks" },
  resolve:            { label: "NATO, US and European resolve and cohesion", group: "Brakes", covers: "Deployments, air defence, spending, sanctions unity, elections, US commitment" },
};

export const PATHWAY_INFO: Record<PathwayId, { label: string; counts: string; serious: string }> = {
  airspace:           { label: "Airspace and stray munitions", counts: "Drones, missiles, aircraft or debris crossing into NATO, EU or Moldovan airspace or territory", serious: "Deaths, a manned aircraft shot down, or a deliberate strike" },
  sabotage:           { label: "Sabotage and covert action", counts: "Arson, explosives, rail attacks, assassination plots, recruited proxies", serious: "Deaths, or an attack that halts critical infrastructure" },
  maritime:           { label: "Maritime and undersea", counts: "Cables, pipelines, shadow-fleet incidents, naval confrontations in the Baltic, Black Sea and North Sea", serious: "A vessel attacked or seized by force, or a major cable or pipeline cut" },
  cyber_ew:           { label: "Cyber and electronic warfare", counts: "GPS jamming and spoofing; attacks on grids, rail, telecoms and hospitals; election hacking", serious: "Disruption of essential services for more than a day" },
  military_pressure:  { label: "Military pressure on NATO", counts: "Force build-ups, probes, exercises near the Baltics, Finland, Suwałki and Belarus", serious: "Russian forces deliberately crossing a NATO border" },
  nuclear:            { label: "Nuclear and radiological", counts: "Doctrine changes, exercises, deployments; safety of Zaporizhzhia, Chornobyl and other plants", serious: "Raised nuclear readiness, or a radiological release" },
  political_economic: { label: "Political, economic and migration pressure", counts: "Election interference, energy coercion, migration used as a weapon, governments shifting toward Moscow", serious: "A NATO or EU decision blocked, or a government toppled, by a Russian operation" },
};

export type Rung = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const RUNGS: { rung: Rung; name: string; qualifies: string }[] = [
  { rung: 0, name: "Hostile pressure", qualifies: "Threats, information operations, sanctions fights; no physical effect" },
  { rung: 1, name: "Grey-zone interference", qualifies: "GPS jamming or spoofing, cyberattacks, migrants pushed across borders, smuggling balloons, airspace approaches without a violation, exercises and build-ups near borders" },
  { rung: 2, name: "Covert attacks on European soil", qualifies: "Sabotage, arson, rail or cable damage, assassination plots, with suspected or attributed Russian involvement" },
  { rung: 3, name: "Overt military incidents, no deaths", qualifies: "Russian drones, missiles or aircraft entering NATO, EU or Moldovan airspace or waters; allied shoot-downs; airports closed by military drones; naval stand-offs; war munitions or debris landing on European territory" },
  { rung: 4, name: "Deadly or deliberate incident", qualifies: "Deaths on European soil caused by the war, or a deliberate Russian strike on European territory or assets" },
  { rung: 5, name: "Limited direct conflict", qualifies: "Deliberate, sustained Russian military action against a NATO or EU state (incursion, blockade, seizure); Article 5 invoked" },
  { rung: 6, name: "General war or nuclear use", qualifies: "Large-scale war between Russia and NATO or EU states, or any nuclear detonation" },
];

export const PROBABILITY_TERMS = {
  remote:                { label: "Remote",                min: 0,  max: 5 },
  highly_unlikely:       { label: "Highly unlikely",       min: 10, max: 20 },
  unlikely:              { label: "Unlikely",              min: 25, max: 35 },
  realistic_possibility: { label: "Realistic possibility", min: 40, max: 50 },
  likely:                { label: "Likely",                min: 55, max: 75 },
  highly_likely:         { label: "Highly likely",         min: 80, max: 90 },
  almost_certain:        { label: "Almost certain",        min: 95, max: 100 },
} as const;                     // UK PHIA yardstick; values in the gaps (6–9, 21–24, …) are invalid
export type ProbabilityTerm = keyof typeof PROBABILITY_TERMS;
export const CONFIDENCE = ["low", "moderate", "high"] as const;
export const TRENDS = ["up", "down", "flat"] as const;
export const IMPACT_LABELS = { 1: "Local disruption", 2: "National disruption under a day", 3: "Major disruption or casualties", 4: "Multiple deaths or alliance crisis", 5: "War-level" } as const;

export const ATTRIBUTION = {
  1: { label: "Reported",    means: "The incident happened; cause unknown" },
  2: { label: "Suspected",   means: "Officials or credible media raise a Russian link" },
  3: { label: "Attributed",  means: "A government formally blames Russia or its proxies" },
  4: { label: "Established", means: "Charges or convictions, or a joint attribution by allies, the EU or NATO" },
} as const;

export const VERIFICATION = {
  1: { label: "Claimed",          means: "Ukraine claims it, or a single credible report" },
  2: { label: "Acknowledged",     means: "Russian officials report an attack, fire or debris at the site" },
  3: { label: "Geolocated",       means: "Open-source geolocation or satellite fire detection at the site" },
  4: { label: "Damage assessed",  means: "Imagery or credible reporting confirms damage" },
  5: { label: "Effect confirmed", means: "Measurable effect: capacity offline, export ban, flights halted" },
} as const;

export const TIER1 = ["PL", "LT", "LV", "EE", "FI", "RO", "MD"] as const;
export const TIER2 = ["DE", "DK", "SE", "NO", "NL", "BE", "GB", "CZ", "SK", "HU", "BG"] as const;
export const OTHER_EUROPE = ["AL", "AT", "CY", "ES", "FR", "GR", "HR", "IE", "IS", "IT", "LU", "ME",
  "MK", "MT", "PT", "SI", "TR"] as const;
export const COUNTRIES = [...TIER1, ...TIER2, ...OTHER_EUROPE] as const; // 35: EU + NATO Europe + Moldova
export type CountryCode = (typeof COUNTRIES)[number];
export const THREAT_LOCATIONS = ["BY", "RU", "UA"] as const; // allowed only as Incident.location_country (see rules)
export const COHESION_WATCH = ["HU", "SK"] as const;
export const COUNTRY_NAMES: Record<CountryCode | (typeof THREAT_LOCATIONS)[number], string> = {
  PL: "Poland", LT: "Lithuania", LV: "Latvia", EE: "Estonia", FI: "Finland", RO: "Romania", MD: "Moldova",
  DE: "Germany", DK: "Denmark", SE: "Sweden", NO: "Norway", NL: "Netherlands", BE: "Belgium",
  GB: "United Kingdom", CZ: "Czechia", SK: "Slovakia", HU: "Hungary", BG: "Bulgaria",
  AL: "Albania", AT: "Austria", CY: "Cyprus", ES: "Spain", FR: "France", GR: "Greece", HR: "Croatia",
  IE: "Ireland", IS: "Iceland", IT: "Italy", LU: "Luxembourg", ME: "Montenegro", MK: "North Macedonia",
  MT: "Malta", PT: "Portugal", SI: "Slovenia", TR: "Türkiye",
  BY: "Belarus", RU: "Russia", UA: "Ukraine",
};

export const COUNTRY_SCORES = {
  1: { label: "Low",      anchor: "No incident affecting the country at rung 2 or above in 30 days, and no active strategic indicator naming it" },
  2: { label: "Guarded",  anchor: "Rung-1 activity affecting it in 30 days (jamming, balloons, migration pressure)" },
  3: { label: "Elevated", anchor: "A rung-2 or rung-3 incident affecting it in 30 days" },
  4: { label: "High",     anchor: "A rung-4 incident affecting it in 30 days, or an active strategic indicator naming it" },
  5: { label: "Severe",   anchor: "Direct conflict (rung 5 or above) involving it" },
} as const;

export const SEAS = ["baltic", "black_sea", "north_sea", "barents_norwegian", "mediterranean", "other"] as const;

// Incident types per pathway, with the allowed rung range. "other" is allowed in every pathway with
// range 1–6, and produces a warning.
export const INCIDENT_TYPES = {
  airspace: {
    drone_incursion:   { label: "Drone incursion",            min: 3, max: 4 },
    missile_incursion: { label: "Missile incursion",          min: 3, max: 4 },
    aircraft_violation:{ label: "Aircraft airspace violation",min: 3, max: 4 },
    debris_impact:     { label: "War debris on territory",    min: 3, max: 4 },
    shootdown:         { label: "Allied shoot-down",          min: 3, max: 4 },
    airport_closure:   { label: "Airport or base closed by drones", min: 2, max: 3 },
    balloon_incursion: { label: "Balloon incursion",          min: 1, max: 1 },
  },
  sabotage: {
    arson:                  { label: "Arson",                   min: 2, max: 4 },
    explosive:              { label: "Explosive or parcel bomb", min: 2, max: 4 },
    rail_sabotage:          { label: "Rail sabotage",           min: 2, max: 4 },
    infrastructure_sabotage:{ label: "Infrastructure sabotage", min: 2, max: 4 },
    assassination_plot:     { label: "Assassination plot",      min: 2, max: 4 },
    proxy_recruitment:      { label: "Proxy recruitment",       min: 2, max: 2 },
    sabotage_arrest:        { label: "Arrest for sabotage plot", min: 2, max: 2 },
  },
  maritime: {
    cable_damage:          { label: "Cable damage",                min: 2, max: 3 },
    pipeline_damage:       { label: "Pipeline damage",             min: 2, max: 4 },
    shadow_fleet_incident: { label: "Shadow-fleet incident",       min: 1, max: 3 },
    naval_confrontation:   { label: "Naval or air confrontation at sea", min: 3, max: 4 },
    vessel_seizure:        { label: "Vessel seized by force",      min: 3, max: 4 },
    mine_drift:            { label: "Drifting mine",               min: 1, max: 4 },
    strike_at_sea:         { label: "Strike on a vessel in European waters", min: 3, max: 4 },
  },
  cyber_ew: {
    gnss_jamming:   { label: "GPS jamming",          min: 1, max: 1 },
    gnss_spoofing:  { label: "GPS spoofing",         min: 1, max: 1 },
    cyberattack:    { label: "Cyberattack",          min: 1, max: 2 },
    ddos:           { label: "DDoS",                 min: 1, max: 1 },
    election_cyber: { label: "Election cyber operation", min: 1, max: 2 },
  },
  military_pressure: {
    exercise_near_border: { label: "Exercise near NATO border", min: 1, max: 1 },
    force_buildup:        { label: "Force build-up",            min: 1, max: 1 },
    snap_readiness:       { label: "Snap readiness check",      min: 1, max: 1 },
    probe:                { label: "Probe",                     min: 1, max: 3 },
    border_violation:     { label: "Border violation",          min: 2, max: 5 },
  },
  nuclear: {
    nuclear_exercise:   { label: "Nuclear exercise",   min: 1, max: 1 },
    nuclear_deployment: { label: "Nuclear deployment", min: 1, max: 1 },
    plant_safety_event: { label: "Nuclear plant safety event", min: 1, max: 4 },
  },
  political_economic: {
    election_interference:   { label: "Election interference",   min: 1, max: 2 },
    influence_operation:     { label: "Influence operation",     min: 1, max: 2 },
    disinformation_campaign: { label: "Disinformation campaign", min: 1, max: 1 },
    energy_coercion:         { label: "Energy coercion",         min: 1, max: 1 },
    migration_pressure:      { label: "Migration pressure",      min: 1, max: 1 },
  },
} as const;

export const STRIKE_TARGET_TYPES = ["refinery", "oil_depot", "oil_terminal", "pipeline", "power",
  "airbase", "ammunition_depot", "defence_industry", "military_hq", "air_defence", "naval",
  "logistics_rail", "radar", "other"] as const;
export const WEAPON_TYPES = ["drone", "missile", "sea_drone", "sabotage", "unknown"] as const;

export const SOURCE_CATEGORIES = {
  ua_gov:            { n: 1,  label: "Ukrainian government and military" },
  ru_gov:            { n: 2,  label: "Russian government and military" },          // incl. regional governors
  ru_state_media:    { n: 3,  label: "Russian state media and milbloggers" },      // signal only
  ua_independent:    { n: 4,  label: "Ukrainian independent media" },
  ru_by_independent: { n: 5,  label: "Russian and Belarusian independent media" },
  intl_press:        { n: 6,  label: "Wires and major international press" },
  eu_regional_press: { n: 7,  label: "Frontline and regional European press" },
  eu_gov_security:   { n: 8,  label: "European governments, militaries and security services" }, // incl. Moldova, police, prosecutors
  nato_eu:           { n: 9,  label: "NATO and EU institutions" },
  us_gov:            { n: 10, label: "US government" },
  osint_data:        { n: 11, label: "Open-source intelligence and monitoring data" },
  think_tank:        { n: 12, label: "Think tanks and named analysts" },
  markets_energy:    { n: 13, label: "Markets and energy data" },
  intl_bodies:       { n: 14, label: "Humanitarian, nuclear safety and international bodies" },
  third_party:       { n: 15, label: "Third-party states" },
} as const;
export type SourceCategoryId = keyof typeof SOURCE_CATEGORIES;

export const METRICS = {
  ru_drones_launched:       { label: "Russian drones launched (overnight)",      unit: "count" },
  ru_drones_intercepted:    { label: "Russian drones shot down or suppressed",   unit: "count" },
  ru_missiles_launched:     { label: "Russian missiles launched (overnight)",    unit: "count" },
  ru_missiles_intercepted:  { label: "Russian missiles intercepted",             unit: "count" },
  ru_territory_gain_km2:    { label: "Russian net territorial gain",             unit: "km2" },
  ua_deep_strikes:          { label: "Ukrainian deep strikes logged",            unit: "count" },
  ua_max_strike_depth_km:   { label: "Deepest Ukrainian strike",                 unit: "km" },
  ru_refinery_offline_pct:  { label: "Russian refinery capacity offline",        unit: "%" },
  eu_gas_storage_pct:       { label: "EU gas storage",                           unit: "%" },
  ttf_eur_mwh:              { label: "TTF gas price",                            unit: "EUR/MWh" },
  brent_usd:                { label: "Brent",                                    unit: "USD/bbl" },
  urals_usd:                { label: "Urals",                                    unit: "USD/bbl" },
  gnss_interference_index:  { label: "GPS interference, Baltic and Finland",     unit: "%" },
  znpp_offsite_power_lines: { label: "Zaporizhzhia off-site power lines",        unit: "count" },
} as const;
export type MetricId = keyof typeof METRICS;

export const INDICATOR_TIERS = ["incident", "strategic", "driver"] as const;
export const INDICATOR_STATUS = ["dormant", "watch", "active"] as const;
export const IMPORTANCE = ["pivotal", "major", "notable"] as const;
export const HORIZONS = ["30d", "90d", "6-12m", "2-5y"] as const;

// ---------------------------------------------------------------------------------------------------
// Derived lists and types. Not part of the SPEC §4.2 block; they give the schemas tuple-typed enums.

export const PROBABILITY_TERM_IDS = ["remote", "highly_unlikely", "unlikely", "realistic_possibility",
  "likely", "highly_likely", "almost_certain"] as const satisfies readonly ProbabilityTerm[];
export const SOURCE_CATEGORY_IDS = ["ua_gov", "ru_gov", "ru_state_media", "ua_independent",
  "ru_by_independent", "intl_press", "eu_regional_press", "eu_gov_security", "nato_eu", "us_gov",
  "osint_data", "think_tank", "markets_energy", "intl_bodies", "third_party"] as const satisfies readonly SourceCategoryId[];
export const METRIC_IDS = ["ru_drones_launched", "ru_drones_intercepted", "ru_missiles_launched",
  "ru_missiles_intercepted", "ru_territory_gain_km2", "ua_deep_strikes", "ua_max_strike_depth_km",
  "ru_refinery_offline_pct", "eu_gas_storage_pct", "ttf_eur_mwh", "brent_usd", "urals_usd",
  "gnss_interference_index", "znpp_offsite_power_lines"] as const satisfies readonly MetricId[];
export const INCIDENT_LOCATIONS = [...COUNTRIES, ...THREAT_LOCATIONS] as const;

export type Tier1Country = (typeof TIER1)[number];
export type Tier2Country = (typeof TIER2)[number];
export type ThreatLocation = (typeof THREAT_LOCATIONS)[number];
export type Confidence = (typeof CONFIDENCE)[number];
export type Trend = (typeof TRENDS)[number];
export type IndicatorTier = (typeof INDICATOR_TIERS)[number];
export type IndicatorStatus = (typeof INDICATOR_STATUS)[number];
export type Importance = (typeof IMPORTANCE)[number];
export type Horizon = (typeof HORIZONS)[number];
export type StrikeTargetType = (typeof STRIKE_TARGET_TYPES)[number];
export type WeaponType = (typeof WEAPON_TYPES)[number];
export type Impact = 1 | 2 | 3 | 4 | 5;
export type Score = 1 | 2 | 3 | 4 | 5;
export type AttributionLevel = 1 | 2 | 3 | 4;
export type VerificationLevel = 1 | 2 | 3 | 4 | 5;

export const PATHWAYS_WITH_THREAT_LOCATIONS: readonly PathwayId[] = ["military_pressure", "nuclear"];
export const OTHER_INCIDENT_TYPE = { label: "Other", min: 1, max: 6 } as const;

/** The rung range for an incident type, or null when the type isn't defined for the pathway. */
export function incidentTypeInfo(pathway: PathwayId, type: string): { label: string; min: number; max: number } | null {
  if (type === "other") return OTHER_INCIDENT_TYPE;
  const types: Record<string, { label: string; min: number; max: number }> = INCIDENT_TYPES[pathway];
  return Object.hasOwn(types, type) ? types[type]! : null;
}

export function isTier1(code: string): code is Tier1Country {
  return (TIER1 as readonly string[]).includes(code);
}

export function isTier2(code: string): code is Tier2Country {
  return (TIER2 as readonly string[]).includes(code);
}

export function isEuropean(code: string): code is CountryCode {
  return (COUNTRIES as readonly string[]).includes(code);
}

export const NO_CHANGE_TEXT = "No material change.";
export const TAIWAN_NO_NEWS = "No fresh Taiwan-relevant development; prior assessment unchanged.";
export const SEED_START = "2022-02-24";
