# EuropeTracker analytic standards

These rules bind every brief. The definitions match `lib/vocab.ts`; if the two ever differ,
`vocab.ts` wins and this file must be fixed in the same pull request.

## 1. The question

Every brief answers one question: how likely is the Russia-Ukraine war to spill into Europe in the next
30 days, by which routes, where, and what changed in the last 24 hours? The war matters here only as
the driver of that risk.

**Spillover** means hostile activity linked to Russia's war that causes physical harm, disruption or a
military confrontation on the territory, airspace, waters or critical infrastructure of a European
country other than Ukraine and Russia. It also covers anything that draws a European state into direct
military confrontation with Russia.

**In scope:** the 35 EU and NATO European countries plus Moldova (`COUNTRIES` in vocab.ts). Belarus and
Kaliningrad are sources of threat, not places at risk.

## 2. Spillover ladder

| Rung | Name | What qualifies |
|---|---|---|
| 0 | Hostile pressure | Threats, information operations, sanctions fights; no physical effect |
| 1 | Grey-zone interference | GPS jamming or spoofing, cyberattacks, migrants pushed across borders, smuggling balloons, airspace approaches without a violation, exercises and build-ups near borders |
| 2 | Covert attacks on European soil | Sabotage, arson, rail or cable damage, assassination plots, with suspected or attributed Russian involvement |
| 3 | Overt military incidents, no deaths | Russian drones, missiles or aircraft entering NATO, EU or Moldovan airspace or waters; allied shoot-downs; airports closed by military drones; naval stand-offs; war munitions or debris landing on European territory |
| 4 | Deadly or deliberate incident | Deaths on European soil caused by the war, or a deliberate Russian strike on European territory or assets |
| 5 | Limited direct conflict | Deliberate, sustained Russian military action against a NATO or EU state (incursion, blockade, seizure); Article 5 invoked |
| 6 | General war or nuclear use | Large-scale war between Russia and NATO or EU states, or any nuclear detonation |

- **Current rung** is the highest rung of any logged incident dated in the last 30 days. Code computes
  it and you must match it.
- **Next-rung odds** is the 30-day probability of at least one incident at any higher rung.

## 3. Pathways and serious-incident thresholds

| Pathway | What counts | Serious incident |
|---|---|---|
| Airspace and stray munitions | Drones, missiles, aircraft or debris crossing into NATO, EU or Moldovan airspace or territory | Deaths, a manned aircraft shot down, or a deliberate strike |
| Sabotage and covert action | Arson, explosives, rail attacks, assassination plots, recruited proxies | Deaths, or an attack that halts critical infrastructure |
| Maritime and undersea | Cables, pipelines, shadow-fleet incidents, naval confrontations in the Baltic, Black Sea and North Sea | A vessel attacked or seized by force, or a major cable or pipeline cut |
| Cyber and electronic warfare | GPS jamming and spoofing; attacks on grids, rail, telecoms and hospitals; election hacking | Disruption of essential services for more than a day |
| Military pressure on NATO | Force build-ups, probes, exercises near the Baltics, Finland, Suwałki and Belarus | Russian forces deliberately crossing a NATO border |
| Nuclear and radiological | Doctrine changes, exercises, deployments; safety of Zaporizhzhia, Chornobyl and other plants | Raised nuclear readiness, or a radiological release |
| Political, economic and migration pressure | Election interference, energy coercion, migration used as a weapon, governments shifting toward Moscow | A NATO or EU decision blocked, or a government toppled, by a Russian operation |

Each pathway gets a daily score with four parts:

- `serious_odds`: the 30-day probability of at least one serious incident.
- `impact`: what happens if it does. 1 = local disruption, 2 = national disruption for under a day,
  3 = major disruption or casualties, 4 = multiple deaths or an alliance crisis, 5 = war-level.
- `trend` against yesterday: up or down if the probability moved by 5 points or more, otherwise flat.
- A rationale that names the base rate and the reason for any change.

**Start from the base rate.** The context file gives incidents in the last 30 days, the 90-day
baseline, serious incidents in the last 12 months and the monthly average since 2022. Move away from it
only for reasons you can name. A move of 15 points or more needs a cited source.

## 4. Counting rules for the incident database

Consistency matters more than completeness, because the base rates come from these counts.

- **One incident per event.** A wave of drones crossing in one night is one incident; put the number in
  the summary.
- **airspace:** log every confirmed violation of NATO, EU or Moldovan airspace or territory by Russian
  drones, missiles or aircraft. Also log war debris landing on such territory and every allied
  shoot-down. Log drone overflights that close an airport or military base when officials suspect a
  state link.
- **sabotage:** log incidents that officials link (at least "suspected") to Russia or its proxies,
  including arrests for specific sabotage plots. Not ordinary crime.
- **maritime:** log every case of:
  - damage to an undersea cable or pipeline
  - boarding or detention of a shadow-fleet vessel by a European state
  - naval or air confrontation at sea
  - drifting mine found in European waters
  - strike on a vessel in European waters
- **cyber_ew:** log GPS interference only when it disrupts aviation or shipping (diversions, changed
  airport procedures) or a government makes a statement. Background jamming goes in the
  `gnss_interference_index` metric. Log cyberattacks only when they disrupt a service or a government
  attributes them.
- **military_pressure:** log exercises, build-ups, snap readiness checks and probes near NATO borders
  that officials announce or report. Also log border violations by Russian forces, including removal of
  border markers.
- **nuclear:** log nuclear exercises, deployments to Belarus or Kaliningrad, and plant-safety events
  the IAEA reports (loss of off-site power, strikes near plants).
- **political_economic:** log operations that officials expose (election interference, influence
  networks), steps of energy coercion, and migration pushes that officials acknowledge.
- **Rungs follow type.** Each type has an allowed rung range in `INCIDENT_TYPES`. Deaths on European
  soil caused by the war mean rung 4 or higher, and `serious: true`.
- **Locations BY, RU or UA** are allowed only for military_pressure and nuclear. List the European
  countries affected. The rung stays at 1 unless effects physically reach Europe.

## 5. Attribution ladder (incidents in Europe)

1. **Reported:** the incident happened, cause unknown.
2. **Suspected:** officials or credible media raise a Russian link.
3. **Attributed:** a government formally blames Russia or its proxies.
4. **Established:** charges or convictions, or a joint attribution by allies, the EU or NATO.

Raise a level only with new evidence, and cite it.

**Sources for incidents:**
- Every new incident needs at least 2 sources from at least 2 categories.
- When the affected government or agency has spoken (`host_statement: "yes"`), one source must be that
  statement (`eu_gov_security`) or NATO or the EU (`nato_eu`).
- If they haven't spoken yet (`"none_yet"`), the attribution can be at most 2.

## 6. Verification ladder (Ukraine's deep strikes into Russia)

1. **Claimed:** Ukraine claims it, or there is a single credible report.
2. **Acknowledged:** Russian officials or governors report an attack, fire or debris at the site. Needs
   a `ru_gov` or `ru_state_media` source.
3. **Geolocated:** open-source geolocation or a satellite fire detection (NASA FIRMS) at the site.
   Needs an `osint_data` source.
4. **Damage assessed:** imagery or credible reporting confirms damage. Fill `damage`; needs an
   `intl_press` or `osint_data` source.
5. **Effect confirmed:** a measurable effect, such as capacity offline, an export ban or flights
   halted. Fill `effect`; needs a `markets_energy`, `intl_press` or `ru_gov` source.

**Recording strikes:**
- Use the Kyiv date of the strike. For night strikes, use the date the night began.
- Record the target, region, approximate distance from Ukraine-controlled territory, and the weapon if
  known (with `weapon_detail`, for example a named missile or drone type).
- Set `western_weapon` only if a source says so; otherwise null.

## 7. Probability scale and confidence

Use the UK intelligence probability yardstick. The number must sit inside its term's band. The gaps
(6–9, 21–24, 36–39, 51–54, 76–79, 91–94) are deliberately not allowed.

| Term | Range |
|---|---|
| Remote | 0–5% |
| Highly unlikely | 10–20% |
| Unlikely | 25–35% |
| Realistic possibility | 40–50% |
| Likely | 55–75% |
| Highly likely | 80–90% |
| Almost certain | 95–100% |

Confidence is separate from probability:
- **Low:** thin or conflicting evidence.
- **Moderate:** credible but incomplete evidence.
- **High:** several independent confirmations and a stable base rate.

In prose, use the term and the number together, for example "unlikely (30%)".

## 8. Frontline country scores (tier 1: PL, LT, LV, EE, FI, RO, MD)

| Score | Label | Anchor |
|---|---|---|
| 1 | Low | No incident affecting the country at rung 2 or above in 30 days, and no active strategic indicator naming it |
| 2 | Guarded | Rung-1 activity affecting it in 30 days (jamming, balloons, migration pressure) |
| 3 | Elevated | A rung-2 or rung-3 incident affecting it in 30 days |
| 4 | High | A rung-4 incident affecting it in 30 days, or an active strategic indicator naming it |
| 5 | Severe | Direct conflict (rung 5 or above) involving it |

- **Floor:** set by incidents in the last 30 days whose `affected` list includes the country. None
  gives 1; max rung 1 gives 2; rung 2–3 gives 3; rung 4 gives 4; rung 5 or above gives 5.
- **Allowed range:** the floor, or one above it with a reason. Higher only when an active strategic
  indicator names the country; list it in `indicator_ids`.
- **Changes:** any change needs a reason and sources.
- **Tier 2** countries (DE, DK, SE, NO, NL, BE, GB, CZ, SK, HU, BG) appear only on days something
  touches them.
- **Cohesion:** set `cohesion_flag` for Hungary or Slovakia when a veto, energy deal or sanctions block
  is in play.

## 9. Coverage categories (sweep all 12, in this order)

| # | Category | Look for |
|---|---|---|
| 1 | Battlefield trajectory | Territory changes (DeepState, ISW), key axes, signs of collapse or breakthrough, manpower |
| 2 | Deep strikes and long-range escalation | New strikes into Russia and their verification; Western long-range weapons decisions; Russian threats against supplier countries |
| 3 | Russian strike campaign | Overnight drone and missile totals; strikes on western Ukraine, Odesa and the Danube, near NATO borders; energy grid damage |
| 4 | Ceasefire and diplomacy | Talks, proposals, security guarantees, sanctions packages, frozen assets |
| 5 | Airspace incursions | Violations, shoot-downs, debris, airport closures, balloons |
| 6 | Sabotage and covert action | Incidents, arrests, charges, official attributions |
| 7 | Maritime and undersea | Cables, pipelines, shadow fleet, naval incidents, mines, strikes at sea |
| 8 | Cyber and electronic warfare | Jamming affecting aviation or shipping, cyberattacks with disruption or attribution |
| 9 | Russian military posture toward NATO | Exercises, build-ups, redeployments, Belarus, Kaliningrad, rhetoric about the Baltics or Finland |
| 10 | Nuclear signalling and radiological safety | Doctrine, exercises, deployments, IAEA plant-safety updates |
| 11 | Political, economic and migration pressure | Election interference, influence networks, energy coercion, migration pushes |
| 12 | NATO, US and European resolve | Deployments, air defence, spending, sanctions unity, Hungary and Slovakia, US commitment |

A category with nothing material gets status `no_change` and the exact text "No material change."

## 10. Sources

**Rules:**
- At least 10 sources from at least 7 of the 15 categories. On a quiet day: 5 sources from 4.
- Every non-quiet brief includes at least one Ukrainian official source (`ua_gov`) and at least one
  Russian official or state source (`ru_gov` or `ru_state_media`).
- Pivotal and major developments need at least 2 sources from at least 2 categories.
- Numbers in the bottom line need two sources from different categories (`bottom_line_source_ids`).
- Cite only URLs you opened, saw in search results, or found in the source pack. Never cite a
  news.google.com link; open the original article.
- Many Russian government websites block foreign visitors. Use their Telegram channels
  (`https://t.me/s/<channel>`) or reporting about them.
- Don't rely on X (Twitter). Cite official websites, or reporting that quotes the post.

| # | Category id | What it is |
|---|---|---|
| 1 | ua_gov | Ukrainian government and military: General Staff, Air Force, SBU, HUR, President's office |
| 2 | ru_gov | Russian government and military: Kremlin, Foreign Ministry, Ministry of Defence, border-region governors |
| 3 | ru_state_media | Russian state media and milbloggers: TASS, RIA, RT, Rybar. Signal only, never fact on their own |
| 4 | ua_independent | Ukrainian independent media: Kyiv Independent, Ukrainska Pravda, Suspilne |
| 5 | ru_by_independent | Russian and Belarusian independent media: Meduza, Mediazona, The Insider, Astra, Zerkalo, Belsat |
| 6 | intl_press | Wires and major international press: Reuters, AP, AFP, Bloomberg, FT, BBC, NYT, WSJ |
| 7 | eu_regional_press | Frontline and regional European press: Notes from Poland, TVN24, ERR, LSM, LRT, Delfi, Yle, Digi24, NewsMaker, DR, NRK, SVT, Spiegel |
| 8 | eu_gov_security | European (including Moldovan) governments, armed forces, police, prosecutors and security services, including their annual threat reports |
| 9 | nato_eu | NATO, SHAPE, EU Council, Commission, EEAS |
| 10 | us_gov | White House, State Department, Pentagon, envoys, Congress |
| 11 | osint_data | ISW, DeepState, GeoConfirmed, NASA FIRMS, flight and ship tracking, GPS-jamming maps, ACLED |
| 12 | think_tank | RUSI, IISS, CSIS, Carnegie Russia Eurasia, ECFR, ICDS, CNA, named analysts |
| 13 | markets_energy | Brent and Urals, TTF, EU gas storage (AGSI), Kpler, CREA |
| 14 | intl_bodies | UN monitoring mission, IAEA, ICRC, UNHCR, OSCE |
| 15 | third_party | China, Turkey, India, Belarus, the Hungarian and Slovak governments, Gulf and Vatican mediators |

## 11. Voice

- **Lead with the answer.** Neutral, precise, plain English. No hype, no emoji, no padding.
- **Numbers over adjectives.** Quantify every gap: "three incursions in 30 days against a baseline of
  1.2 a month".
- **Claims stay claims.** Attribute every statement by name: "Poland's Operational Command said…",
  "TASS reported…". When a figure is contested, pair the official claim with the counter-claim.
- **Separate fact from judgement.** Cited facts first; assessments marked "We assess…".
- **Keep standing assumptions in force** until evidence retires them. Don't drop a structural risk
  because one day was calm.
- **Say what would change your mind** (`change_my_mind`).
- **Pivotal is rare:** at most one pivotal development per brief, and usually none.
- **The ceasefire paradox.** A ceasefire usually lowers near-term incident risk but can raise
  medium-term risk if Russia rebuilds forces facing NATO. Assess both.
- **Translations.** Translate quotes yourself and mark them "(translated)".
- **Spelling.** English place names: Kyiv, Chornobyl, Zaporizhzhia, Suwałki, Narva.

## 12. Forecasts

- Each forecast is binary and dated, with observable resolution criteria. At most 3 new per day, and at
  most 30 open.
- Record a base rate: what a forecaster using only history would say. It's how the brief's value gets
  measured.
- Update a forecast when evidence changes. Resolve it on or after its date, citing a source.
- Prefer questions that test the brief's main judgements. For example: "Will Russian drones or missiles
  enter the airspace of a NATO member between 10 November and 9 December 2026?" or "Will any person be
  killed on NATO territory by Russian munitions before 30 June 2027?"

## 13. Weekly outlook (Mondays)

- **Medium term (6 to 12 months) and long term (2 to 5 years):** one question each, with an estimate
  and up to 200 words. Anchor them on European intelligence services' and NATO's public assessments and
  on indicators we can observe: force regeneration, defence spending and production, US posture.
- **Assumptions check:** every active assumption marked holds, weakening or broken, with a note.
- **Calibration note:** how resolved forecasts scored against their base rates.

## 14. Impact on Taiwan

Every brief has this section, at most 150 words. It says how today's developments might affect Taiwan.
Lead with the most direct impact, and name the mechanism and its likely size, not just the topic.
Angles, most direct first:

1. **US attention and weapons supply.** Air-defence interceptors, munitions and production capacity
   going to Europe that Taiwan also needs (Patriot, NASAMS, HIMARS, Stinger, artillery shells). Delivery
   backlogs and priority decisions.
2. **China's calculus.** What the West's response (resolve, sanctions, deterrence of Russia) signals to
   Beijing. China's support for Russia's war economy, such as components in drones and missiles.
   China–Russia military cooperation near Taiwan or Japan.
3. **Military lessons for Taiwan's defence.** Drones and counter-drone, deep strikes, sea drones against
   naval forces, air defence against mass raids, grid and energy resilience, civil defence.
4. **Energy and markets.** LNG and oil prices, shipping and insurance, as they bear on Taiwan's energy
   security.
5. **Chips and export controls.** Taiwanese components found in Russian weapons; enforcement on
   Taiwanese firms; sanctions as a precedent for a Taiwan contingency.
6. **Diplomacy.** European engagement with Taiwan; EU–China relations; North Korea's role in the war
   and what it means for the region.

If nothing new bears on Taiwan, write exactly: "No fresh Taiwan-relevant development; prior assessment
unchanged."

## 15. Quiet days

With fewer than 3 material developments, set `quiet_day: true` and write a short brief. Source minimums
relax (5 sources, 4 categories). Never invent significance.
