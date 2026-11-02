# EuropeTracker design v0.2

2026-11-02 · JL · Replaces v0.1 · **Approved by JL on 2026-11-02**

> This is a frozen copy of the approved Claude Doc "EuropeTracker design v0.2"
> (https://claude.ai/artifact/JnMoMzhG4UQeDXtj4J3kKW). Change it only through a pull request.
>
> **Decisions taken at approval (2026-11-02):**
> - No alerts (JL, after approval). JL gets updates from the Claude interface, so the daily run is a
>   scheduled task in the Claude app, like ME, and its reply is the morning update. Sections 5.2 step
>   7, 5.6 "Watchdog" and 5.8 "Alerts" below are superseded; see `SPEC.md` §0.3, §7.7 and §8.3.
> - The Taiwan section stays, as "Impact on Taiwan": how developments might affect Taiwan
>   (`routine/STYLE.md` §14).
> - The repo is public (JL, 2026-11-02, after approval). Before it went public, details of Kobol's
>   security settings were removed from sections 5.6 and 9.
> - Moving the ME run to 07:00 and Kobol's macOS update setting are left to JL.
> - The coding happens in a separate thread working from `SPEC.md`.
>
> **Refinements made while writing the build spec** are listed in `SPEC.md` §0.3. Where this document
> and `SPEC.md` differ, `SPEC.md` governs.

## Summary

- **Purpose.** Every morning, answer one question: how likely is the Russia-Ukraine war to spill into Europe, by which routes, where, and what changed in the last 24 hours? The war itself is tracked as the set of drivers behind that risk.
- **What you read first.** A seven-rung spillover ladder, scores for seven spillover pathways, a table of frontline countries and the warning signs that moved. An incident database gives every score a base rate.
- **Timing.** Starts at 05:30 Taipei and is normally live by about 06:15. It retries once automatically and stops by 06:55 at the latest, so it always finishes before the ME run and well before 8am.
- **Build.** A script owns every step that must not fail. Claude does the research and writes one file. The repo `8gara8/EuropeTracker` now exists (private for now), and I'll create the Vercel project at the first code push.
- **Process.** You approve this doc, I write the SPEC.md and AGENTS.md using your existing spec process, then build in phases with tests, then do three supervised runs before it goes live.

## What the final review changed

| Area | v0.1 | v0.2 | Why |
| --- | --- | --- | --- |
| Goal | War tracker with a risk lens | Spillover-risk tracker, with the war as its drivers | Your stated goal |
| Headline measure | Six war gauges | Spillover ladder, seven pathways, country table | Fixed definitions, comparable day to day, tied to events you can observe |
| Evidence | Briefs only | Incident database back to 2022, each incident graded for attribution | Scores need base rates, not impressions |
| Time horizons | 30 days only | 30 days updated daily; 6 to 12 months and 2 to 5 years updated every Monday | The risk of a deliberate attack moves slowly, and daily changes would mislead |
| Coverage | 10 war categories | 12 categories, grouped as drivers, pathways and brakes | Maps one-to-one onto the risk model |
| Sources | 14 categories | 15, adding European security services and monitoring data. Every incident needs the affected government's statement plus an independent check | Attribution is where spillover reporting most often goes wrong |
| Collection | Web search only | A script gathers a source pack first, then Claude verifies against it | Better coverage, more primary sources, faster and repeatable |
| Language | Not specified | A standard probability scale, confidence stated separately, base rate first | Makes the scores calibrated and checkable |
| Schedule | 10:30 | 05:30, hard stop at 06:55 | Your 8am requirement |
| Security | Not addressed | The agent can only read the web and write a draft | It reads Russian state media and Telegram, which is hostile content by design |
| Reliability | Not addressed | Flags overnight macOS updates that leave Kobol at the login screen | That would silently stop both trackers |

## 1. Mission and scope

EuropeTracker is a daily risk brief, not a war diary. Its job is to tell you, before work, whether the danger to Europe went up or down, why, and what to watch next.

**Spillover** means hostile activity linked to Russia's war that causes physical harm, disruption or a military confrontation on the territory, airspace, waters or critical infrastructure of a European country other than Ukraine and Russia. It also covers anything that draws a European state into direct military confrontation with Russia.

**Countries in scope.** EU and NATO Europe plus Moldova. Belarus and Kaliningrad are tracked as sources of threat, not as places at risk.

**Time horizons.**

- **Next 30 days**, updated daily: incidents and serious-incident risk.
- **Next 6 to 12 months**, updated Mondays: ceasefire scenarios, Russian force rebuilding, NATO posture.
- **Next 2 to 5 years**, updated Mondays: the risk of a deliberate Russian war with NATO, anchored on European intelligence services' public timelines and on indicators we can observe.

## 2. Risk model

### 2.1 Spillover ladder (the headline)

Each brief reports the current rung, meaning the highest rung reached in the last 30 days, and the 30-day probability of reaching a higher one. Every rung has a fixed definition, so the history can be charted and compared.

| Rung | Name | What qualifies | Example |
| --- | --- | --- | --- |
| 0 | Hostile pressure | Threats, information operations, sanctions fights; no physical effect | Routine nuclear rhetoric |
| 1 | Grey-zone interference | GPS jamming, cyberattacks, migrants pushed across borders, smuggling balloons, airspace approaches without a violation | Jamming of civil aviation over the Baltic |
| 2 | Covert attacks on European soil | Sabotage, arson, rail or cable damage, assassination plots, with suspected or attributed Russian involvement | The 2024 parcel-fire plots that European officials linked to Russian intelligence |
| 3 | Overt military incidents, no deaths | Russian drones, missiles or aircraft entering NATO or EU airspace or waters; allied shoot-downs; airports closed by military drones; naval stand-offs | Allied jets shooting down Russian drones over Poland (September 2025) |
| 4 | Deadly or deliberate incident | Deaths on NATO or EU soil caused by the war, or a deliberate Russian strike on European territory or assets | Przewodów, Poland, 2022 (two killed by a stray air-defence missile) |
| 5 | Limited direct conflict | Deliberate, sustained Russian military action against a NATO or EU state, such as an incursion, blockade or seizure; Article 5 invoked | None so far |
| 6 | General war or nuclear use |  | None so far |

The examples are for illustration. The seed phase (section 6) checks the record up to today and sets the starting rung.

### 2.2 Seven spillover pathways

Each pathway shows four things daily: incidents in the last 30 days against the average of the previous 90; the 30-day probability of a serious incident (on the scale in 2.7); its impact if it happens (1 to 5); and confidence.

| Pathway | What counts | Serious-incident threshold |
| --- | --- | --- |
| 1. Airspace and stray munitions | Drones, missiles, aircraft or debris crossing into NATO, EU or Moldovan airspace or territory | Deaths, a manned aircraft shot down, or a deliberate strike |
| 2. Sabotage and covert action | Arson, explosives, rail attacks, assassination plots, recruited proxies | Deaths, or an attack that halts critical infrastructure |
| 3. Maritime and undersea | Cables, pipelines, shadow-fleet incidents, naval confrontations in the Baltic, Black Sea and North Sea | A vessel attacked or seized by force, or a major cable or pipeline cut |
| 4. Cyber and electronic warfare | GPS jamming and spoofing, attacks on grids, rail, telecoms and hospitals, election hacking | Disruption of essential services for more than a day |
| 5. Military pressure on NATO | Force build-ups, probes, exercises near the Baltics, Finland, Suwałki and Belarus | Russian forces deliberately crossing a NATO border |
| 6. Nuclear and radiological | Doctrine changes, exercises, deployments; safety of Zaporizhzhia, Chornobyl and other plants | Raised nuclear readiness, or a radiological release |
| 7. Political, economic and migration pressure | Election interference, energy coercion, migration used as a weapon, governments shifting toward Moscow | A NATO or EU decision blocked, or a government toppled, by a Russian operation |

### 2.3 Frontline countries

- **Tier 1, scored daily from 1 to 5, with a cited reason for any change:** Poland, Lithuania, Latvia, Estonia, Finland, Romania, Moldova.
- **Tier 2, listed only when something happens:** Germany, Denmark, Sweden, Norway, the Netherlands, Belgium, the UK, Czechia, Slovakia, Hungary, Bulgaria.
- Hungary and Slovakia are also flagged for **cohesion risk**: vetoes, energy deals and blocked sanctions.

### 2.4 Drivers, and the ceasefire paradox

The war matters to this brief because it moves spillover risk. Four drivers are tracked:

1. **Battlefield trajectory.** Who is gaining, and whether a collapse or breakthrough is in sight.
2. **Deep strikes and long-range escalation.** Ukraine's strikes into Russia, Western long-range weapons, and Russian threats against the countries supplying them.
3. **Russia's strike campaign, especially near NATO borders.** Western Ukraine and the Odesa and Danube areas are where stray drones and missiles come from.
4. **Ceasefire and diplomacy.**

A ceasefire is not automatically good news for this model. It would probably cut near-term incidents, since fewer drones would fly near borders. But it could raise the medium-term risk if Russia used the pause to rebuild forces facing NATO, which several European intelligence services have warned about. The model tracks both effects separately.

### 2.5 Incident database and base rates

`incidents` holds every spillover-relevant incident in Europe since February 2022. It is seeded from published trackers, government reports and press compilations, then added to daily. Each entry records the date, country, pathway, rung, a description, attribution level, casualties, disruption (for example, hours an airport was closed) and sources. It powers the base rates, the monthly charts and the sanity check on every score.

**Attribution ladder** for incidents in Europe:

1. **Reported:** the incident happened, cause unknown.
2. **Suspected:** officials or credible media raise a Russian link.
3. **Attributed:** a government formally blames Russia or its proxies.
4. **Established:** charges or convictions, or a joint attribution by allies, the EU or NATO.

### 2.6 Warning indicators

**Incident indicators (30-day horizon):**

- Airspace violations per month, by country
- Russian drone and missile tracks near the Polish, Romanian and Moldovan borders
- GPS interference over the Baltic and Finland
- Sabotage incidents and arrests per month
- Undersea cable and pipeline incidents
- Hours of airport or port closures caused by drones

**Strategic indicators (would come before deliberate action against NATO):**

- Russian units moving from Ukraine toward the Leningrad and Moscow military districts, Kaliningrad or Belarus, or new formations near Finland and the Baltics
- Mobilisation or large reserve call-ups
- Exercises bigger than declared, or snap readiness checks near NATO borders
- Ammunition, fuel or medical stockpiling near NATO borders
- Changes in nuclear readiness, or nuclear and Oreshnik deployments in Belarus or Kaliningrad
- Official Russian framing that builds a pretext: Russian "compatriots" in the Baltics, Narva, Kaliningrad transit, Suwałki
- Diplomatic warning signs: Russian diplomats' families leaving, embassy drawdowns, airspace closures
- Public disclosures of cyber footholds in European grids, rail or telecoms
- Changes in US force posture or commitment in Europe (an amplifier)

Each indicator is marked **dormant**, **watch** or **active**, with its latest evidence and date. Driver tripwires carried over from v0.1 stay on the list: a NATO Article 4 or 5 request, a US decision on Tomahawk-class weapons, and a signed ceasefire framework.

### 2.7 Analytic standards

- **Probability language.** Every likelihood uses the UK intelligence probability scale with a number: remote (5% or less), highly unlikely (10 to 20%), unlikely (25 to 35%), realistic possibility (40 to 50%), likely (55 to 75%), highly likely (80 to 90%), almost certain (95% or more). Confidence (low, moderate or high) is stated separately.
- **Base rate first.** Each score starts from the incident base rate and moves only for named reasons.
- **Claims stay claims.** Every side's statements are reported as claims. Key numbers need two sources from different categories, and state media is treated as a signal of intent, never as fact.
- **Two ladders.** Deep strikes are graded by verification and incidents in Europe by attribution.
- **Standing assumptions,** carried over from MEtracker, stay in force until evidence retires them. Mondays add a check of the five assumptions the whole assessment rests on.
- **Competing explanations.** A pivotal but ambiguous incident, such as an accident versus a deliberate probe, gets a short competing-explanations box.
- **What would change our mind.** One line under the headline judgement.
- **Quiet days** get a short brief, never filler.
- **Scored forecasts.** Forecasts are logged, resolved and scored, and a calibration review runs monthly.
- **Corrections** are appended openly, never silently edited.

## 3. Research design

### 3.1 Coverage categories

Each run sweeps all twelve. A category with nothing material gets one line, not filler.

| Group | # | Category |
| --- | --- | --- |
| Drivers | 1 | Battlefield trajectory |
|  | 2 | Deep strikes and long-range escalation |
|  | 3 | Russian strike campaign, especially near NATO borders |
|  | 4 | Ceasefire and diplomacy |
| Pathways | 5 | Airspace incursions and stray munitions |
|  | 6 | Sabotage and covert action |
|  | 7 | Maritime and undersea infrastructure |
|  | 8 | Cyber and electronic warfare |
|  | 9 | Russian military posture toward NATO, including Belarus and Kaliningrad |
|  | 10 | Nuclear signalling and radiological safety |
|  | 11 | Political, economic and migration pressure |
| Brakes | 12 | NATO, US and European resolve and cohesion (deployments, air defence, spending, sanctions unity, elections) |

### 3.2 Source rubric

**Rules:**

- At least 10 sources from at least 7 of the 15 categories below.
- Every incident in Europe cites the affected government or agency plus one independent source.
- Every major item includes the Russian framing where one exists.
- Every number in the Bottom line has two sources from different categories.

| # | Category | Examples |
| --- | --- | --- |
| 1 | Ukrainian government and military | General Staff, Air Force, SBU, HUR, President's office |
| 2 | Russian government and military | Kremlin, Foreign Ministry, Ministry of Defence, border-region governors (via Telegram, since many Russian state websites block foreign visitors) |
| 3 | Russian state media and milbloggers | TASS, RIA, RT, Rybar (as signal only) |
| 4 | Ukrainian independent media | Kyiv Independent, Ukrainska Pravda, Suspilne |
| 5 | Russian and Belarusian independent media | Meduza, Mediazona, The Insider, Astra, Zerkalo, Belsat |
| 6 | Wires and major international press | Reuters, AP, AFP, Bloomberg, FT, BBC, NYT, WSJ |
| 7 | Frontline and regional European press | Notes from Poland, TVN24, ERR, LSM, LRT, Delfi, Yle, Digi24, NewsMaker, DR, NRK, SVT, Spiegel |
| 8 | European governments, militaries and security services | Defence ministries and armed forces, police and prosecutors, the annual threat reports of the Estonian, Lithuanian, Danish, Finnish, Swedish, Norwegian, Dutch, German and UK services |
| 9 | NATO and EU institutions | NATO, SHAPE, EU Council, Commission, EEAS |
| 10 | US government | White House, State, Pentagon, envoys, Congress |
| 11 | Open-source and monitoring data | ISW, DeepState, GeoConfirmed, NASA FIRMS fire data, flight and ship tracking, GPS-jamming maps, ACLED |
| 12 | Think tanks and named analysts | RUSI, IISS, CSIS, Carnegie Russia Eurasia, ECFR, ICDS, CNA |
| 13 | Markets and energy data | Brent and Urals, TTF gas, EU gas storage (AGSI), Kpler, CREA |
| 14 | Humanitarian, nuclear safety and international bodies | UN monitoring mission, IAEA, ICRC, UNHCR, OSCE |
| 15 | Third-party states | China, Turkey, India, Belarus, the Hungarian and Slovak governments, Gulf and Vatican mediators |

### 3.3 Collection method

1. **Source pack (script, about 2 minutes).** A collector reads a fixed list kept in `research/sources.yaml`, about 80 entries:
   - news feeds
   - public Telegram channels through their web preview (the Ukrainian Air Force and General Staff, Russia's Ministry of Defence, border governors, DeepState)
   - official press pages (NATO, defence ministries, IAEA)
   - keyword news queries in English, Ukrainian, Russian, Polish, the Baltic languages, Finnish and Romanian

   It keeps items inside the 24-hour window, removes duplicates, ranks them and caps each category, producing about 300 items with headline, outlet, time, link and snippet.
2. **Sweep (Claude).** Goes category by category through the pack, opens the primary sources, and searches to fill gaps.
3. **Verify (Claude).** Makes the required source pairings, assigns verification and attribution levels, and translates quotes, marking them as translated.

X (Twitter) is not relied on because of its login wall. Posts are cited through official websites or through reporting about them.

### 3.4 Deep-strike verification ladder (kept from v0.1)

1. Claimed
2. Acknowledged by Russian officials
3. Geolocated
4. Damage assessed
5. Effect confirmed (for example, refinery capacity offline or a fuel export ban)

Each strike-log entry records the target type, region, distance from Ukraine, the weapon if known, and its sources.

### 3.5 Optional data sign-ups

These improve the data but aren't required at launch:

- an ACLED account (event data)
- a free NASA FIRMS key (fire detections at strike sites)

They need you to sign up, since I don't create accounts.

## 4. The daily brief

The target is **at most 1,800 words**. Mondays add up to 600 words for the weekly outlook.

1. **Bottom line** (at most 120 words): the current rung, the biggest change and the one thing to watch.
2. **Spillover board:** the ladder rung and 30-day odds of the next rung, the seven pathways with their changes, and changes in the frontline countries.
3. **New incidents in Europe,** each with its attribution level.
4. **Drivers:** battlefield, deep strikes (with new strike-log entries), Russian strikes near NATO borders, ceasefire track.
5. **Warning indicators:** status changes only.
6. **Analytical judgement** (at most 400 words), with forecasts and what would change our mind.
7. **Taiwan read-through** (at most 150 words, if kept).
8. **Next 72 hours:** dated events to watch.
9. **Sources.**

**Monday weekly outlook:** the 6-to-12-month and 2-to-5-year judgements, the assumptions check, and a calibration update.

**Daily metrics, charted on the site:**

| Metric | Primary source | Cross-check |
| --- | --- | --- |
| Airspace incidents and incidents in Europe (rolling 30 days) | Incident database | Host governments |
| GPS interference over the Baltic and Finland | GPS-jamming map data (feasibility checked in Phase 3) | Aviation notices |
| Russian drones and missiles launched and intercepted | Ukrainian Air Force | ISW |
| Russian net territorial gain | DeepState | ISW (usually a day behind at 05:30) |
| Ukrainian deep strikes, count and maximum depth | Strike log |  |
| Russian refinery capacity offline | Reuters or Bloomberg calculations | Kpler, company statements |
| EU gas storage, TTF, Brent and Urals | AGSI, market data |  |
| Zaporizhzhia plant status | IAEA |  |

## 5. Tech design

### 5.1 Schedule and deadline

| Taipei time | What happens |
| --- | --- |
| 05:30 | The run starts. It covers the 24 hours to 05:30 Taipei (about midnight in Kyiv) |
| about 06:15 | Normally live on the site |
| up to 06:25 | If the first attempt failed, one automatic retry |
| 06:55 | Hard stop. If there's still no brief, a failure alert goes out immediately |
| about 07:05 | Outside watchdog checks that today's brief exists |
| 07:30 | ME run starts (unchanged) |

The ME run currently goes live between 07:50 and 08:02 (08:01 on 1 November). If you want both safely before 8, move ME to 07:00 in the Claude app's Scheduled page; I can't reach that task from here.

### 5.2 Daily run

launchd starts `scripts/daily.sh`:

1. **Preflight (script):** a lock stamped with the process ID and cleared on exit; checks for network, a push-capable remote (`git ls-remote`) and a clean tree; then `git pull`.
2. **Collect (script):** builds the source pack (section 3.3).
3. **Research and draft (Claude Code, headless):** reads `state.json`, the recent briefs and the pack, then writes `drafts/DATE.json`, under time and turn limits.
4. **Validate (script):** checks structure, word budgets, the source rubric, both ladders, forecast format and that every source exists. Errors come back in a machine-readable form.
5. **Repair:** Claude resumes the same session to fix the listed errors, at most twice.
6. **Publish (script):** moves the draft into place, applies updates to the state, incident, strike and forecast files, commits with a fixed identity and pushes. Archive snapshots are requested in the background.
7. **Report (script):** sends a success or failure message. A failure also opens a GitHub issue and saves the draft to `needs-review/`.

### 5.3 Agent sandbox

The research step reads hostile content every day, so the agent is fenced in:

- **Can:** search the web, fetch pages, read files inside the repo, and write only to `drafts/`.
- **Cannot:** run a shell, use git, reach other files on Kobol, use other connectors, or publish.

Even a fooled agent can only produce a draft that must pass validation. The login token comes from the macOS keychain at run time and is never in the repo or within the agent's reach.

### 5.4 Data files

```
content/briefs/YYYY-MM-DD.json   one per day, the only copy of each brief
content/incidents/YYYY.json      incident database, one file per year, append-only
content/strikes.json             deep-strike log, append-only
content/state.json               ladder, pathway and country scores, indicators, assumptions, running totals
content/forecasts.json           every forecast, with its resolution and score
content/corrections.json         public corrections log
research/sources.yaml            source list with categories
```

Every file carries a `schema_version`. A single Zod schema serves both the validator and the site.

### 5.5 Site

Next.js on Vercel, generated as static pages and deployed on every push. Pages:

- **Today**
- **Spillover board:** ladder history, pathway heat grid, country table
- **Incidents:** table, filters, monthly chart
- **Strike log**
- **Warning indicators**
- **Forecasts and calibration**
- **Archive**
- **Methodology**
- **RSS feed**

### 5.6 Reliability on Kobol

- **Native builds.** Native Apple-silicon Node, pinned, and a native Claude Code command line. The current one is an Intel build running under Rosetta.
- **Logs.** Each day's run is logged under `logs/`, and a one-line summary of every run goes to `logs/runs.jsonl`.
- **Overnight macOS updates (needs you).** An update that restarts Kobol overnight can leave it at the login screen, and then neither tracker runs. How Kobol handles updates is your call.
- **Other jobs.** The AYW product scan runs Mondays around 06:30. It uses a different folder, so nothing conflicts beyond shared Claude usage. The 03:00 nightly job finishes long before.
- **Watchdog.** The outside watchdog is a GitHub Actions check. GitHub sometimes runs scheduled checks late, so it is a backstop for a dead Kobol, not the main alert.

### 5.7 Testing and change control

- **Code changes** go through pull requests with tests (validator against sample briefs, plus a full build) and a Vercel preview.
- **Content** reaches `main` only through the pipeline's direct push.
- **A schema change** needs updated sample briefs and a version bump.

### 5.8 Accounts and access

- **GitHub:** `8gara8/EuropeTracker` is created and private. Creating a public repo needs your OK, so I can flip it to public at launch if you want it to match MEtracker. The site itself is public either way.
- **Vercel:** I have access to your "8gara8's projects" team, where metracker lives, and will create and link the project at the first push.
- **Alerts:** a Telegram bot you create with @BotFather (I'll give you a one-line command to store its token in the keychain), or GitHub email only.

## 6. From design to build

Your two-document process from the old account (design doc, then a SPEC.md that Claude Code builds from) is still the right backbone, and this doc is document one. Four upgrades:

1. **The spec is executable.** The first phase builds the schema, validator and sample briefs with tests, so every later phase is checked against them.
2. **Docs live in the repo** as markdown (`docs/DESIGN.md`, `SPEC.md`, `AGENTS.md`), versioned with the code. We review here; the approved version gets frozen into the repo.
3. **A content quality gate.** You read three supervised runs before anything is scheduled.
4. **Reconcile before revising.** Any later design change starts by checking the repo against the spec, the rule from your ship-product-workflow. That prevents the drift MEtracker's README shows.

I build it here on Kobol in `~/Projects/EuropeTracker`, with code changes as pull requests you can review.

| Phase | What gets built | Done when |
| --- | --- | --- |
| 0 | SPEC.md, AGENTS.md and DESIGN.md committed | You approve the spec |
| 1 | Schemas, validator, sample briefs, tests | Good samples pass; bad samples fail with clear errors |
| 2 | Site pages and the Vercel project | Every page renders on a preview link |
| 3 | Collector, daily script, agent prompt, repair loop, alerts, in dry-run mode | A full dry run produces a valid draft without pushing |
| 4 | Seed data: incidents since 2022, last 60 days of strikes, starting scores, indicators, first forecasts | You review the baseline |
| 5 | Three supervised runs, then launchd at 05:30, the watchdog and alerts | The first unattended run is live before 06:55 |
| After 2 weeks | Tune budgets, sources and scores to what you actually read |  |

## 7. What it deliberately is not

- Not a breaking-news alert service. It is one morning brief.
- Not a battlefield map. It links to DeepState and ISW.
- Not a full history of the war. War coverage is limited to what moves spillover risk.
- Not advocacy. Every side's claims are reported as claims.
- Not the Middle East, which stays with MEtracker, and not the Indo-Pacific beyond a short read-through.

## 8. Success measures

- **Reliability:** live by 06:55 on at least 28 of 30 days, and never a silent failure.
- **Rigour:** every incident in Europe carries an attribution level and a government source, with at least 7 source categories a day.
- **Calibration:** after 90 days, the forecasts score better than a forecaster using base rates alone.
- **Usefulness:** you can read the Bottom line and the board in two minutes.

## 9. Decisions for you

1. Approve the spillover-centred design, or tell me what to change.
2. Move ME to 07:00 so it reliably lands before 8? (You change it in the Claude app.)
3. Overnight macOS updates on Kobol: how should they be handled?
4. Alerts: Telegram, or GitHub email only?
5. Taiwan read-through: keep or drop?
6. Repo at launch: public like MEtracker, or stay private?
