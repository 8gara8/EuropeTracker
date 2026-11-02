# Seed report

**For JL's review (SPEC §9 Phase 4).** This is the starting database the daily briefs build on: incidents
from 24 February 2022 to 2 November 2026, Ukraine's main deep strikes of the last 60 days, the starting
state of the board, and 11 open forecasts. Nothing here is published until this PR is merged.

The source files are `research/seed/*.yaml`; `npm run seed:build` turns them into `content/` and
regenerates the tables at the end of this report. Edit the YAML, not the JSON. The builder refuses to run
once the first daily brief exists.

## The numbers that matter

- **249 incidents, 47 strikes, 11 forecasts.** Every record passes `npm run validate:all`.
- **Current rung: 4 (deadly or deliberate incident).** It is set by Russian drone strikes on merchant
  ships off Romania and Bulgaria in October: on 15 October a tanker was hit at anchor inside Romanian
  territorial waters, and strikes on 5 and 23 October killed sailors just outside them. Without the ship
  strikes the rung would be 3, set by drone incursions into Romania, Moldova and Lithuania.
- **Highest pathway risk: maritime**, at likely (70%) for another serious incident in 30 days, because
  four of its five serious incidents in the past year came in October 2026.
- **Highest country scores:** Romania 4 (high), Lithuania 3 and Moldova 3 (elevated).

## Decisions for you

Most of the seed follows the counting rules mechanically. These calls are judgements; each is easy to
change in the YAML if you see it differently.

1. **Ship strikes near Romania and Bulgaria are rung 4.** A death makes an incident rung 4 under the
   rules, and the Yara J strike was inside Romanian waters. If you read "deaths on European soil" as land
   only, the 23 October and 5 October strikes would drop to rung 3, but the 15 October strike (deliberate,
   in territorial waters) would keep the current rung at 4.
2. **The Leipzig airport drone attack (4 August 2026) is sabotage at rung 3, serious.** It was covert
   (rung 2 by type) but used a weaponised drone against an aircraft, closed the airport, and Germany
   formally blamed Russia. It is not rung 4 because nothing exploded and no one died.
3. **Poland's drone incursion of 10 September 2025 is rung 3, not serious.** It is the biggest airspace
   event in the database, with NATO's first shoot-downs and Article 4, but the serious threshold is deaths,
   a manned aircraft shot down, or a deliberate strike.
4. **Ukrainian drones that strayed into the Baltic states, Finland, Bulgaria and Turkey are logged.** They
   are war munitions on European territory. Attribution is 1, or 2 where officials blamed Russian jamming
   for diverting them. Przewodów (2022, a Ukrainian interceptor that killed two people) is logged the same
   way.
5. **Airport closures by unidentified drones are rung 2.** Copenhagen, Oslo, Aalborg, Munich, Berlin,
   Bremen, Brussels, Liège, Gothenburg, Eindhoven and Hanover all closed after sightings, and officials
   suspected state actors, but no drone was identified as military. Copenhagen's police said in June 2026
   they could not prove drones had been there at all.
6. **Shadow-fleet boardings are rung 2, Russian escorts rung 1,** and the Russian frigate firing warning
   shots near a British yacht (16 June 2026) rung 3.
7. **Nord Stream (2022) and Balticconnector (2023) are logged with attribution 1**, because no Russian link
   has been established; both are serious as major pipeline cuts.
8. **Left out:** the Ukrainian Su-27 that landed in Romania on day one; the US MQ-9 downed over the Black
   Sea (not a European asset); drones over bases that did not close (Île Longue, Annaburg, Camp Reedo,
   Mechernich); the killing of the Russian artist Semyon Skrepetsky in Poland (no official Russian link);
   and the Polish soldier killed at the Belarus border in 2024 (the migration type can't carry a death).
9. **Ukrainian nuclear plants list the nearest EU states as affected** (Moldova and Romania for
   Zaporizhzhia, Poland and Lithuania for Chornobyl), since an incident needs at least one.

## How it was researched

- **Compilations used as indexes**, never as sources: Wikipedia's lists of airspace violations during the
  war (English and Polish editions), the 2026 drone incidents in Romania and in the Baltic states and
  Finland, the 2025 European drone sightings, the 2025 Polish incursion and rail sabotage, the 2024 cable
  and Estlink 2 cases, the Elisa cable case, the Smyrtos seizure, the Russian shadow fleet, Ukrainian
  attacks on the shadow fleet, Russian sabotage operations in Europe, the 2024 incendiary parcels, the
  Leipzig airport attack, Russian hybrid warfare, the Zaporizhzhia crisis, Moldova and the war, the
  Carfil sabotage, the Finnish and Estonian lists of airspace violations, and the September to November
  2026 timeline of the war. Each record cites the underlying government statement or news report.
- **Targeted searches** filled the gaps: Finnish and Danish violations in 2022 and 2024, the 2025 Belgian
  airport closures, sabotage cases in Germany and Czechia, cyber cases, and the nuclear, military and
  political records.
- **Every source URL was fetched on 2 November 2026.** Of 367 links, 293 loaded; 74 were refused to an
  automated reader (Reuters, WSJ, the Telegraph, AgerPres, Moldova's defence ministry and others answer
  401, 403 or 429 to scripts) but are live pages; two dead links were replaced. Titles are each page's
  current headline.

## Coverage and known gaps

- **Complete as far as the compilations go:** rung 3 and above in Poland, the Baltic states, Finland,
  Sweden, Denmark, Germany and Bulgaria; serious incidents everywhere; the 30 days that set the current
  board.
- **Romania is incomplete before 2026.** The seed has 46 Romanian airspace incidents, 29 of them in 2026;
  Romania has reported more than 70 since 2022, with the gap in 2023–2025 drone fragments.
- **Moldova is the biggest gap.** Moldova's defence ministry counted 60 airspace violations by 28 July
  2026 (21 of them in 2025); the seed has 19 by that date and only 3 in 2025. October 2026 is covered.
- **Rungs 1 and 2 are representative, not complete:** sabotage (dozens of smaller arsons and arrests a
  year are left out), GPS jamming (mostly background, kept for the metric), cyberattacks, Russian
  exercises, Zaporizhzhia (5 of its 26 losses of off-site power), and political interference.
- **Black Sea mines:** only 2 of the dozens found since 2022 are logged.
- **Effect:** the monthly averages since 2022 understate airspace (Romania, Moldova) and every rung 1–2
  pathway. The 30-day counts and the 90-day baseline, which drive the board, are well covered for
  airspace and maritime.
- **Strikes:** 47 of the main strikes from 3 September to 2 November 2026. Most sit at verification 1
  because the cited sources are Ukrainian media or Ukrainian claims; the daily runs can raise them with
  Russian, geolocation or damage evidence.

## Starting values and why

**Ladder:** rung 4, from the October ship strikes. **Next-rung odds: remote (5%)**, moderate confidence.
Rung 5 needs deliberate, sustained Russian military action against a NATO or EU state, and nothing points
to that within 30 days.

| Pathway | Serious incident in 30 days | Impact | Why |
|---|---|---:|---|
| Airspace | Highly unlikely (15%) | 3 | One serious case since 2022 (about 2%), raised for record incursion tempo and blasts near homes in Galați and Moldova |
| Sabotage | Unlikely (25%) | 3 | Two serious cases in 12 months (about 15%), raised for reported GRU orders in October to step up attacks |
| Maritime | Likely (70%) | 3 | Five serious cases in 12 months, four of them Russian strikes on ships near Romania and Bulgaria in October |
| Cyber and EW | Highly unlikely (10%) | 2 | No serious case since Viasat in 2022, though Norway's services were down for days in August 2026 |
| Military pressure | Remote (3%) | 4 | No deliberate Russian crossing of a NATO border since 2022 |
| Nuclear | Remote (3%) | 5 | No raised readiness or release; Zaporizhzhia's power losses are not serious by definition |
| Political and economic | Highly unlikely (10%) | 3 | No NATO or EU decision blocked, or government toppled, by a Russian operation in the database |

| Country | Score | Why |
|---|---:|---|
| Poland | 2 Guarded | No incident in 30 days (floor 1); one above for Russian drone tracks along the border, balloons and jamming |
| Lithuania | 3 Elevated | A drone exploded over Juodzionys on 18 October (floor 3) |
| Latvia | 2 Guarded | Floor 1; one above for the 18 October alerts, jamming and August incursions |
| Estonia | 2 Guarded | Floor 1; one above for jamming and reports of troops moved toward the border |
| Finland | 2 Guarded | Break-ins at MPs' homes linked to Russian intimidation (floor 2) |
| Romania | 4 High | Deadly drone strikes on ships off its coast in October (floor 4) |
| Moldova | 3 Elevated | Repeated drone and missile crashes in October, two people injured (floor 3) |

**Indicators.** Active: Russian drone tracks near the Polish, Romanian and Moldovan borders; GPS
interference over the Baltic; sabotage tempo; airport closures by drones; nuclear posture (Oreshnik on duty
in Belarus); changes in US posture; Russia's fuel export ban. Watch: airspace tempo (high, but below the
record August baseline); undersea incidents; redeployment toward the Baltics and Finland; exercises;
pretext narratives; diplomatic warning signs; cyber prepositioning; Article 4; ceasefire; refinery
capacity. Dormant: mobilisation, stockpiling, Article 5, long-range US weapons. Each has its evidence in
`content/state.json`.

**Assumptions:** A1–A5 from the spec, unchanged for your review. A1 (Russia avoids deliberate,
attributable armed attacks on NATO territory) is under strain: Germany attributed the Leipzig attack to
Russia, and Russian drones hit a ship inside Romanian waters.

**Forecasts:** 11 open questions across airspace, maritime, sabotage, nuclear, military pressure and the
war itself, each with its base rate (see `content/forecasts.json`).

<!-- seed-build:start -->
Generated by `npm run seed:build` from `research/seed/`. Counts as of 2026-11-02.

### Incidents by pathway and year

| Pathway | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Serious |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| airspace | 11 | 12 | 14 | 36 | 77 | 150 | 1 |
| sabotage | 3 | 2 | 8 | 3 | 5 | 21 | 4 |
| maritime | 3 | 1 | 2 | 12 | 21 | 39 | 9 |
| cyber_ew | 1 | 0 | 3 | 2 | 3 | 9 | 1 |
| military_pressure | 0 | 1 | 1 | 3 | 1 | 6 | 0 |
| nuclear | 3 | 2 | 2 | 4 | 2 | 13 | 0 |
| political_economic | 3 | 2 | 3 | 2 | 1 | 11 | 0 |
| **All** | 24 | 20 | 33 | 62 | 110 | 249 | 15 |

### Incidents by rung and year

| Rung | 2022 | 2023 | 2024 | 2025 | 2026 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 Grey-zone interference | 7 | 5 | 5 | 15 | 9 | 41 |
| 2 Covert attacks on European soil | 5 | 4 | 13 | 20 | 13 | 55 |
| 3 Overt military incidents, no deaths | 11 | 11 | 14 | 27 | 83 | 146 |
| 4 Deadly or deliberate incident | 1 | 0 | 1 | 0 | 5 | 7 |
| 5 Limited direct conflict | 0 | 0 | 0 | 0 | 0 | 0 |
| 6 General war or nuclear use | 0 | 0 | 0 | 0 | 0 | 0 |

### Incidents by affected country (tier 1)

| Country | Incidents | Rung 3+ | Serious |
| --- | ---: | ---: | ---: |
| PL | 36 | 15 | 3 |
| LT | 26 | 8 | 1 |
| LV | 14 | 7 | 0 |
| EE | 19 | 9 | 2 |
| FI | 19 | 7 | 3 |
| RO | 69 | 58 | 4 |
| MD | 57 | 42 | 0 |

### Serious incidents

| Id | Date | Where | Pathway | Rung | Summary |
| --- | --- | --- | --- | ---: | --- |
| INC-2022-0001 | 2022-02-24 | DE | cyber_ew | 2 | An hour before the invasion, a cyberattack on Viasat's KA-SAT network knocked out tens of thousands of satellite modems across Europe, including remote monitoring of about 5,800 German wind turbines, for weeks. |
| INC-2022-0016 | 2022-09-26 | DK | maritime | 2 | Underwater explosions ruptured three of the four Nord Stream 1 and 2 gas pipelines off Bornholm, releasing large amounts of gas. Seismologists recorded blasts equal to hundreds of kilograms of explosive. |
| INC-2022-0018 | 2022-10-08 | DE | sabotage | 2 | Saboteurs cut Deutsche Bahn's GSM-R radio cables at two sites, stopping long-distance and freight trains across northern Germany and to Denmark and the Netherlands for about three hours. |
| INC-2022-0021 | 2022-11-15 | PL | airspace | 4 | During a massive Russian strike on Ukraine, a Ukrainian air-defence missile crashed into a grain dryer in Przewodów, six kilometres inside Poland, killing two farm workers. |
| INC-2023-0016 | 2023-10-08 | FI | maritime | 2 | The Balticconnector gas pipeline between Finland and Estonia and two telecom cables were damaged by a dragged anchor. The pipeline stayed out of service until April 2024. |
| INC-2024-0002 | 2024-02-13 | ES | sabotage | 4 | Maxim Kuzminov, a Russian helicopter pilot who defected to Ukraine in 2023, was found shot dead and run over in a car park in Villajoyosa, Spain. |
| INC-2024-0030 | 2024-11-17 | SE | maritime | 2 | Two undersea data cables, BCS East-West Interlink (Lithuania–Sweden) and C-Lion1 (Finland–Germany), were cut within hours of each other. The BCS cable carried about a third of Lithuania's internet capacity. |
| INC-2024-0033 | 2024-12-25 | FI | maritime | 2 | The Estlink 2 power cable between Finland and Estonia failed, cutting cross-border capacity from 1,016 to 358 MW for months, and four telecom cables were damaged. Finnish special forces boarded and detained the tanker Eagle S, which had left Ust-Luga. |
| INC-2025-0047 | 2025-11-16 | PL | sabotage | 2 | A military-grade explosive tore up the Warsaw–Lublin line used for aid to Ukraine near Mika as a freight train passed; near Puławy a bracket was jammed on the track and wires downed before a train with 473 passengers. Tusk called it unprecedented sabotage. |
| INC-2026-0049 | 2026-07-21 | RO | maritime | 4 | An LPG tanker caught fire after crew said three drones attacked it at night off Sfântu Gheorghe, outside Romania's territorial waters. Romania evacuated the crew; three injured sailors were taken to Tulcea and one later died. |
| INC-2026-0057 | 2026-08-04 | DE | sabotage | 3 | An explosive-laden drone flown over the cellular network hit the wing of a Ukrainian An-124 at Leipzig airport but did not detonate. The airport closed, and a cargo jet going around struck a second drone and declared a mayday. |
| INC-2026-0098 | 2026-10-05 | RO | maritime | 4 | Russian drones sank the Turkish-owned freighter Royad Mammadov, carrying Ukrainian maize from Izmail to Ravenna, off Romania; its captain was killed and 11 crew rescued. A Bulgarian tanker carrying grain to Romania was also sunk; its 18 crew were saved. |
| INC-2026-0100 | 2026-10-13 | BG | maritime | 4 | Drones struck two ships in Bulgaria's waters overnight. The HS Dignity, bound for Brăila, sank with only one crew member rescued; the Malta-flagged Chelsea 3, bound for Giurgiulești, was badly damaged and its 15 crew evacuated, five injured. |
| INC-2026-0103 | 2026-10-15 | RO | maritime | 4 | Russian drones struck two chemical tankers near Sulina. The Yara J caught fire at anchor inside Romanian territorial waters with no casualties; the Wine Trader was hit just outside them, and seven of its crew were missing after a search. |
| INC-2026-0109 | 2026-10-23 | RO | maritime | 4 | A Russian drone hit the Comoros-flagged bulk carrier Khoryv, which sank off Constanța. One sailor died, three were missing and nine were rescued. |

### Strikes by target type and verification

| Target type | 1 | 2 | 3 | 4 | 5 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| air_defence | 1 | 0 | 0 | 0 | 0 | 1 |
| airbase | 7 | 0 | 0 | 0 | 0 | 7 |
| defence_industry | 7 | 0 | 0 | 0 | 0 | 7 |
| naval | 2 | 0 | 0 | 0 | 0 | 2 |
| oil_depot | 1 | 0 | 0 | 0 | 0 | 1 |
| oil_terminal | 1 | 1 | 0 | 0 | 0 | 2 |
| other | 6 | 0 | 0 | 0 | 0 | 6 |
| refinery | 21 | 0 | 0 | 0 | 0 | 21 |

### Computed starting values

- Current rung (highest in the 30 days to 2026-11-02): **4**.

| Pathway | Last 30 days | Monthly baseline (days 31–120) | Serious, 12 months | Monthly average since 2022 | Seed odds | Impact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| airspace | 8 | 12.7 | 0 | 2.7 | highly_unlikely (15%) | 3 |
| sabotage | 1 | 1.3 | 2 | 0.4 | unlikely (25%) | 3 |
| maritime | 4 | 1.3 | 5 | 0.7 | likely (70%) | 3 |
| cyber_ew | 0 | 0.7 | 0 | 0.2 | highly_unlikely (10%) | 2 |
| military_pressure | 0 | 0 | 0 | 0.1 | remote (3%) | 4 |
| nuclear | 0 | 0.3 | 0 | 0.2 | remote (3%) | 5 |
| political_economic | 1 | 0 | 0 | 0.2 | highly_unlikely (10%) | 3 |

| Country | Max rung, 30 days | Floor | Seed score |
| --- | ---: | ---: | ---: |
| PL | 0 | 1 | 2 |
| LT | 3 | 3 | 3 |
| LV | 0 | 1 | 2 |
| EE | 0 | 1 | 2 |
| FI | 1 | 2 | 2 |
| RO | 4 | 4 | 4 |
| MD | 3 | 3 | 3 |
<!-- seed-build:end -->
