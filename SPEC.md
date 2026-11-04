# EuropeTracker — SPEC.md

> Technical build specification for Claude Code. It is self-contained: everything needed to build
> EuropeTracker is in this file or in files it names. The approved design (the "why") is
> `docs/DESIGN.md`. Where the two differ, this spec wins, and every difference is listed in §0.3.

**Version:** 1.0
**Date:** 2026-11-02
**Design doc:** `docs/DESIGN.md` (design v0.2, approved by JL on 2026-11-02)
**Repo:** https://github.com/8gara8/EuropeTracker (public, default branch `main`)
**Pipeline host:** Kobol, `/Users/kobol/Projects/EuropeTracker`

---

## 0. Read first

### 0.1 How to execute this spec

1. Read `AGENTS.md`, then this file end to end, then `routine/STYLE.md` and `routine/PROMPT.md`.
2. Build the phases in §9 in order. Use one branch and one pull request per phase: `phase-1-contract`,
   `phase-2-site`, `phase-3-pipeline`, `phase-4-seed`, `phase-5-golive`.
3. A phase is done only when its milestone commands pass. Paste their output into the PR description.
4. Don't start a phase until the previous phase's PR is merged, unless JL says to stack them.
5. Where this spec says **verify**, check the real tool, flag or website before relying on it, and note
   what you found in the PR.
6. If something here is wrong or impossible, fix this spec in the same PR and add a row to §0.5
   explaining why. Never diverge silently.

### 0.2 Hard constraints

- **Never touch MEtracker** (`/Users/kobol/Documents/MEwar`), its scheduled tasks, its Vercel project
  `metracker`, or any other project on Kobol. MEtracker's morning run starts at 07:30 Taipei and must
  keep working.
- **Native Apple-silicon tools only.** Use `/opt/homebrew/bin/node` and `/opt/homebrew/bin/npm`. Never
  use `/usr/local/bin/node`, which is an Intel build. `scripts/preflight.ts` enforces
  `process.arch === "arm64"`.
- **The repo is public** (JL's decision, 2026-11-02). Never commit secrets, tokens, personal data,
  or details of Kobol's security settings. Don't create any other public surface without JL's say-so.
- **No credential handling.** JL creates and stores tokens (§8.6). Code reads them from the macOS
  keychain at run time. Never print, log, commit or paste a token.
- **The research agent is sandboxed** (§8.5). It gets no shell, no git, no MCP servers, and no write
  access outside `drafts/`.
- **Direct pushes to `main` come only from the daily pipeline**, and only for files under `content/`.
  Code changes go through pull requests.
- **No alerts.** JL gets updates from the Claude interface. The daily run is a scheduled task in the
  Claude app, and its run summary is the update (§7.7, §8.3). Don't add email, Telegram, GitHub-issue,
  watchdog or notification alerts.
- **Times are Asia/Taipei** (UTC+8, no daylight saving) unless labelled otherwise. Kyiv times are
  always labelled.

### 0.3 Differences from the design doc

| Design doc says | This spec does | Why |
|---|---|---|
| `content/strikes.json` | `content/strikes/YYYY.json`, one file per year | Same pattern as incidents, which keeps files and diffs small |
| Brief of at most 1,800 words | Prompt targets 1,800 words or fewer; the validator's hard cap is 2,000 | The buffer avoids MEtracker-style failures from small overshoots |
| A failure opens a GitHub issue; optional Telegram; an outside watchdog | No alerts of any kind. Every run, success or failure, ends with a summary that shows up in the Claude app | JL's decision on 2026-11-02: updates come from the Claude interface, as with MEtracker |
| launchd starts the run at 05:30 | A scheduled task in the Claude app on Kobol starts `scripts/daily.sh` at 05:30 and replies with the run summary | Puts each morning's result where JL already reads ME's. The research agent stays a sandboxed headless sub-process |
| "Every source exists" | Every cited URL must appear in the source pack or in the agent's own fetch or search results | Catches invented URLs without network calls at validation time |
| The agent writes the brief | The agent writes a draft. `publish.ts` adds computed fields such as incident counts and word counts | The model is never trusted with numbers the code can compute |
| Agent restrictions in project settings | Restrictions live in `routine/agent-settings.json`, passed with `--settings` | A restrictive `.claude/settings.json` would also cripple coding sessions in this repo |

### 0.4 Lessons from MEtracker that shaped this spec

| MEtracker problem | Cause | Answer here |
|---|---|---|
| Runs died midway and left stale `.lock` files | The model ran the whole workflow, including locks and cleanup | `scripts/daily.ts` owns the lock and always releases it in `finally` |
| Several runs misdiagnosed tool errors; `read_file` hangs | Desktop Commander quirks inside a long prompt | Headless Claude Code with native tools, in an isolated config dir |
| A stale `gh` token aborted a run that could have pushed | The precondition tested `gh`, not the ability to push | Preflight probes `git ls-remote` against the real remote |
| Evening runs failed on word caps | One total cap shared by different content | Morning only; budgets per field plus a generous total cap |
| Each brief stored three times, plus a 248-line import registry | The format grew by accretion | One JSON file per brief; the site reads the folder |
| Validator crashed under arm64 Node | `node_modules` installed under Rosetta | arm64 enforced in preflight; `npm ci` with native npm |
| URLs "wrapped" as `web.archive.org/web/2026/...` without being archived | A trick to get past link checks | Keep the real URL; request real snapshots in the background |
| Failures only showed as a macOS notification on an empty Mac | The result never reached the reader | Every run ends with a summary in the Claude app's scheduled-task run, which JL already reads |

### 0.5 Changes made during the build

Where building showed this spec was wrong, incomplete or ambiguous, the fix went into the relevant
section in the same PR and is listed here.

| Phase | Spec said | Now | Why |
|---|---|---|---|
| 1 | Appendix B indicator names, some over 80 chars | Four names shortened to fit `name` (≤ 80 chars); the full wording moved into `description` | The spec's own limit; long names also break the indicators table on a phone |
| 1 | `Source.published_at` is an ISO timestamp or null | A timestamp, or a bare `YYYY-MM-DD` date when only the day is known | Sources often show only a date; forcing a fake time invites invented precision or needless repair rounds |
| 1 | Validation codes in §4.11 | Added `RECORD_FIELDS`, and named the `validateAll` codes (`XREF_ID_DUP`, `XREF_ID_YEAR`, `XREF_UNRESOLVED`, `FILE_ORDER`, `FILE_NAME`, `STATE_SHAPE`, `COMPUTED_MISMATCH`) | A seed flag or a future date on a new record would slip past every other rule; cross-file problems need codes like everything else |
| 1 | Validation stops at a Zod failure (implied) | On a schema failure the cross-field rules still run where they can, skipping paths the schema already flagged | One repair round can then fix both kinds of error; repairs are capped at 2 |
| 1 | The validator reads existing records from the context | `validateDraft()` takes the existing records (`World`) separately: `content/` in the pipeline and in the CLI without `--context`; only the context's records with `--context` | The context carries 30 days of incidents and 14 of strikes, but updates can target older records. The pipeline must also validate against its in-memory context, never `drafts/context.json`, which the agent can write |
| 1 | Strike evidence per level (§4.11 `STRIKE_EVIDENCE`) | Read as non-cumulative: each level needs its own evidence, not the evidence of the levels below | A strike can be geolocated before Russia acknowledges it |
| 1 | Fixtures written by hand | `fixtures/src/` builds them (`npm run fixtures:gen`): 3 valid drafts and one invalid draft per code (54), each checked to fail with exactly its own code | Keeps contexts, evidence and mutations in step when a rule or schema changes |
| 1 | `ci.yml` arrives in Phase 2 | Added in Phase 1 without the build step; Phase 2 adds `npm run build` | So every phase's PR passes CI, as §9 requires |
| 1 | `routine/schema/draft-brief.schema.json` (format unspecified) | Printed with short objects on one line: about 50 KB, every line under 1,000 chars | Pretty-printed it was 67 KB; minified, its single line would be truncated by the agent's file reader |
| 1 | `COMPUTED_MISMATCH` covers "a brief's computed counts" | `validateAll` checks `computed.pathways` against the incident files, counting only records whose `added` date is on or before the brief's date; incident updates are checked as merged records (deaths below rung 4 are `INCIDENT_RUNG`, a strike's damage or effect is rechecked even when its level is unchanged); forecast-resolution citations are checked in published briefs too | PR #1 review: these gaps let wrong counts, deaths below rung 4, emptied damage descriptions and broken citations through. The snapshot rule keeps a later backfill from invalidating old briefs |
| 2 | `BriefViewProps` (§6) | Also takes `indicatorsById` and `assumptionsById` | Indicator changes show the indicator's name, and the Monday assumptions check shows each assumption's text |
| 2 | Appendix A tokens | Adds `--on-light` (dark text on the pale probability fills in both themes), `--pw-*` pathway colors (the first seven slots of a categorical palette validated for color-vision deficiency in light and dark), sample-banner and trend colors | In dark mode `--fg` is light, which would vanish on the pale fills; stacked bars need seven separable colors |
| 2 | Charts (§6) | SVG viewBox 400 units wide, figures capped at 560 px, a `<title>` tooltip on every mark and a data table in `<details>`; `MonthlyBars` also takes a `series` list, so the strike log reuses it | Text stays legible from a 375 px phone to a desktop; hover detail without client JavaScript |
| 2 | Methodology prose "from STYLE.md §4" | The page renders STYLE.md §1, §4, §10 (rules), §12 and §14 at build time through `lib/markdown.ts` | One source for the prose, so the site can't drift from the agent's rules |
| 2 | `validateAll` checks schemas, briefs and cross-file rules | It also runs the incident and strike record rules (`INCIDENT_*`, `STRIKE_EVIDENCE`) on every record in the database | Phase 4's seed data gets the same type, rung, location, source and evidence checks as daily records |
| 2 | Sample dataset written for previews | `fixtures/src/site.ts` generates `fixtures/site-content` (10 briefs, 41 incidents, 15 strikes, 8 forecasts) and checks it with `validateAll`; CI checks the committed fixtures are current and builds with both content folders | Keeps the sample coherent as schemas and rules change |
| 2 | `IncidentUpdate.changes` has no `host_statement`; the site shows each weekly check beside the assumption's current text | Updates can set `host_statement` (with the statement in `add_sources`), and the update rules check it on the merged record; a published brief's `assumptions_check` entries carry the assumption's text as assessed, and the page shows that text | PR #2 review: an incident created before its government spoke could never be raised above attribution 2 without failing `validateAll` at publish, and revising an assumption changed what archived outlooks said |
| 2 | Vercel Node 24.x | Node 26.x, Vercel's default at creation, plus an Ignored Build Step (§8.1) | Matches Kobol's Node; CI still builds on 24 |
| 2 | Screenshots with Playwright "if available" | Taken with `playwright-core` driving the installed Chrome, outside the repo | Playwright isn't installed on Kobol; nothing is added to the project's dependencies |
| 3 | `npm install -g` the Claude CLI; flags including `--max-turns 150` | Installed in `/Users/kobol/.europetracker/cli`; flags updated for 2.1.316 (§8.4): `--restricted`, `--safe-mode`, `--tools`, `dontAsk`, a fallback model, no `--max-turns` | A global install would shadow JL's own `claude`; the new flags fence the agent in more tightly than allow and deny lists alone |
| 3 | Run outcome from the agent's exit code | From the transcript's final `result` event (`is_error`) and the draft file | The CLI exits 0 even when sign-in fails |
| 3 | Pack Markdown lists an item under every category it covers | Full line under its first category; a short "see <category>" line under the others. Google News items show "(lead: search for the original article)" instead of their redirect URL | The first real pack was 263 KB; it is now about 107 KB. The redirect URLs can't be cited or reliably opened |
| 3 | Source registry candidates | 79 feeds, all live on 2026-11-02: 16 Telegram channels, 29 RSS feeds, 34 Google News searches. ISW, NATO and the US State Department block or lack RSS, so they are site searches | Verified with `npm run sources:check` |
| 3 | Undated items are dropped; `--check-feeds` reports load failures | The collector also reads the IAEA's "26-10-30  17:50" dates (in the channel's zone) and the EU Council's Atom `<updated>`; `--check-feeds` reports `NODATE` for a feed whose items all lack a readable date | Both feeds loaded but every item was dropped as undated, so they added nothing, and the check called them ok |
| 3 | Validate against the context | `daily.ts` validates against the context it built in memory (a copy goes to `logs/DATE.context.json`), never `drafts/context.json` | The agent can write in `drafts/` |
| 3 | `--dry-run`: no git writes | Preflight also skips `git checkout main` and `git pull` on a dry run, and allows uncommitted changes | A dry run must work from a feature branch |
| 3 | The repo lives in `/Users/kobol/Documents/EuropeTracker` | It lives in `/Users/kobol/Projects/EuropeTracker` (moved 2026-11-02) | `~/Documents` is synced by iCloud Drive, which made conflict copies ("state 2.json", ".git/index 2") of files the pipeline rewrites. The 05:30 run refuses a tree with stray files, and iCloud can roll a file back to an older copy. `~/Projects` isn't synced |
| 3 | Preflight runs `git pull --ff-only` and exits 0 when today's brief exists; publish pushes once and reports success | Preflight and publish sync main with GitHub by rebasing local brief commits (content/ only) onto it. A brief committed here but missing on GitHub is pushed by the next run or `npm run publish -- --date D`, and success is reported only once GitHub's main has it. Publish refuses to run off `main` or with uncommitted `content/` changes. Repairs keep `PUBLISH_RESERVE` (4 min) free, and git and the live check stop at the hard stop | PR #3 review: after a failed push both recovery commands refused the brief as "already published"; a publish from another branch reported success without reaching main; publishing and the live check could run past 06:55 |
| 3 | daily.ts runs its helpers by relative path | It runs `collect.ts` and `archive-urls.ts` with the repo's own `tsx` by absolute path, and takes an injectable token reader | So the end-to-end test can run the real pipeline against a temporary repo with a fake agent |
| 4 | Seed records written straight into `content/` | Written as YAML in `research/seed/` (one file per pathway, plus strikes, state and forecasts); `npm run seed:build` assigns ids in date order, checks every record and the country floors, validates the result as a whole, writes `content/` and the tables in `docs/SEED-REPORT.md`. It refuses to run once a daily brief or a non-seed record exists | Hundreds of records are easier to review and correct as YAML, and ids stay in date order after edits |
| 4 | The end-to-end test copies `content/` | It copies `fixtures/empty-content` (the pre-seed placeholder); a new `tests/seed.test.ts` checks every pathway has an incident and that `research/seed` builds to the committed `content/` until go-live | Seeded content no longer matches the fixture drafts; the seed and `content/` must not drift apart before go-live |
| 4 | Counting rules (STYLE.md §4) | Seed conventions, listed in `docs/SEED-REPORT.md`: stray Ukrainian drones logged as war munitions on European soil; airport closures by unidentified drones at rung 2; European boardings of shadow-fleet ships at rung 2, Russian escorts at rung 1; a death or a strike inside territorial waters at sea is rung 4 | The rules don't cover these cases explicitly; the daily agent should follow the same conventions |
| 4 | The seed builder marks rung 4 or deaths as serious | It also applies the pathway threshold where a type meets it by definition: every maritime strike on or seizure of a vessel is serious, and `INCIDENT_SERIOUS` enforces that for seeds, drafts and updates | Seed review: seven ship strikes below rung 4 (Ukrainian strikes on shadow-fleet tankers off Turkey and Malta, and three ships off Romania) were left non-serious, so maritime showed 5 serious incidents in 12 months instead of 12 |
| 5 | Supervised runs are reviewed on the `review/DATE` Vercel preview | Previews build from the sample data (`ET_CONTENT_DIR`), so `review/DATE` previews now build from `content/` instead | Found before the first supervised run: the preview would have shown the sample briefs, not the brief under review |
| 5 | Plain site design (system fonts, white and blue, light and dark) | ME Tracker's paper design (cream paper, Newsreader, IBM Plex Sans and Mono, masthead with stamp and tab bar, square pills; light only), taken further from a Claude Design mock-up: a spillover gauge beside the title, the eastern flank as a tile map of the seven frontline countries, the pathways as a probability-by-impact risk matrix with a data table, pathway bars, developments split into Europe and the war, and the judgement beside a dark Taiwan card. Appendix A summarises the tokens | JL, on the first supervised preview: look like ME Tracker, then better than it |
| 5 | Three supervised runs on three different days | Two (2 and 3 November), then unattended from 4 November | JL's decision after approving the second brief |
| 5 | `routine/TASK.md`: check on the background run at most every 5 minutes; approve the command and the summary read | The task ends its turn and waits for the app to wake it when the command finishes, and reads files only with the Read tool. Only the command needs approval | The app skips a scheduled run while the previous run is waiting on a permission prompt (seen on Kobol), and checking on the run could have triggered a prompt. The summary is inside the task's folder, so reading it doesn't |
| 5 | §8.3: verify start-time jitter and long background commands | Verified on 4 November: a fixed 7-minute delay (start 05:37), and a 7.5-minute background run woke the task when it ended, so one task is enough | The first unattended morning |

---

## 1. Project overview

EuropeTracker publishes one brief every morning. It answers a single question: how likely is the
Russia-Ukraine war to spill into Europe, through which routes, where, and what changed in the last 24
hours? The war itself is tracked only as the set of drivers behind that risk.

A pipeline on Kobol does the work. A scheduled task in the Claude app starts it at 05:30 and reports the
result there, the same way MEtracker's runs appear. The pipeline collects a source pack, runs headless
Claude Code to research and draft, validates the draft, and commits it to GitHub. Vercel publishes it. The brief is normally live by
about 06:15 Taipei, and never later than 06:55.

- **Site:** https://europetracker.vercel.app. This is Vercel project `europetracker` in team
  "8gara8's projects". Record the actual domain when the project is created.
- **Repo:** https://github.com/8gara8/EuropeTracker (public).
- **Host:** Kobol (MacBook Pro, Apple silicon, user `kobol`). Facts about it are in Appendix C.
- **Reader:** JL, on a phone, before 08:00 Taipei.

**Key features**

1. **Daily brief:** bottom line, spillover board, new incidents, drivers, warning-indicator changes,
   judgement with scored forecasts, impact on Taiwan, next 72 hours, and sources. The spillover
   board has a seven-rung ladder, seven pathways and seven frontline countries. Monday briefs add a
   weekly outlook.
2. **Incident database:** spillover incidents in Europe since February 2022, each graded on a four-level
   attribution ladder. Base rates are computed from it.
3. **Deep-strike log:** Ukrainian strikes into Russia, each graded on a five-level verification ladder.
4. **Warning indicators:** three tiers (incident, strategic, driver), each with a status of dormant,
   watch or active.
5. **Forecast log:** Brier-scored, and compared against a base-rate forecaster.
6. **Pages:** Today, Brief by date, Archive, Spillover board, Incidents, Strike log, Indicators,
   Forecasts, Methodology, and an RSS feed.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16, App Router, every page statically generated | Proven in MEtracker; zero-config on Vercel; no runtime server needed |
| Language | TypeScript 5.9, `strict: true` | Next.js type-checks against the 5.x compiler; TypeScript 7 (native) can wait |
| Validation | Zod 4 | One schema drives the validator, the site loaders and the agent's JSON Schema (`z.toJSONSchema`) |
| Styling | Tailwind CSS 4 (CSS-first config) plus CSS variables | Small and fast; tokens are in Appendix A |
| Charts | Hand-written, server-rendered SVG components | Only three chart types; no client JavaScript and no chart library |
| Content store | JSON files in git | Git is the audit trail; no database |
| Tests | Vitest 5 | Fast and needs no config for TypeScript |
| Script runner | `tsx` | Runs TypeScript scripts directly |
| Feed parsing | `rss-parser`, `cheerio`, `yaml` | RSS feeds, Telegram web previews, the source registry |
| Package manager | npm, with `package-lock.json` committed; installs use `npm ci` | Nothing extra to install on Kobol |
| Local runtime | `/opt/homebrew/bin/node` (arm64, currently v26) | Native; never the Intel Node |
| Vercel runtime | Node 26.x | Vercel's default when the project was created (2026-11-02), the same major as Kobol; CI also builds on Node 24 |
| Research agent | Claude Code CLI, headless (`claude -p`), native arm64 build, isolated config dir | Uses JL's Claude subscription; no API key |
| Scheduler | Scheduled task in the Claude app on Kobol, daily at 05:30, running `scripts/daily.sh` (§8.3) | Same model as MEtracker; each run and its summary show up in the Claude app, where JL gets updates |
| Hosting | Vercel Hobby with the Git integration | Every push to `main` deploys in about a minute |
| Alerts | None | JL's decision; the run summary in the Claude app is the update (§7.7) |

### Key dependencies

These are exact versions, the latest on npm on 2026-11-02. Pin them exactly, with no `^`. If one
fails to install, use the newest patch of the same major version and note it in the PR.

```json
{
  "dependencies": {
    "next": "16.4.3",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "zod": "4.6.7"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "@types/node": "24.19.2",
    "@types/react": "19.x latest at install",
    "@types/react-dom": "19.x latest at install",
    "tailwindcss": "4.3.3",
    "@tailwindcss/postcss": "4.3.3",
    "vitest": "5.0.5",
    "tsx": "4.23.15",
    "rss-parser": "3.13.0",
    "cheerio": "1.2.0",
    "yaml": "2.9.1"
  },
  "engines": { "node": ">=22" }
}
```

There is no ESLint in v1. `tsc --noEmit` and the tests are the quality gate.

---

## 3. Repo layout

```
EuropeTracker/
├── AGENTS.md                      # Agent guide: read first
├── CLAUDE.md                      # Pointer to AGENTS.md
├── SPEC.md                        # This file
├── README.md                      # Short overview
├── docs/
│   ├── DESIGN.md                  # Approved design v0.2 (frozen; change via PR)
│   ├── RUNBOOK.md                 # Phase 3: how to run, debug, recover, rotate tokens
│   └── SEED-REPORT.md             # Phase 4: what the seed data covers, sources, gaps
├── app/                           # Next.js App Router (all static)
│   ├── layout.tsx                 # Root layout: Nav, Footer, metadata, sample banner
│   ├── globals.css                # Tailwind v4 import, @theme tokens, light/dark vars
│   ├── not-found.tsx
│   ├── page.tsx                   # Today: latest brief
│   ├── brief/[date]/page.tsx      # Brief by date
│   ├── archive/page.tsx           # All briefs
│   ├── board/page.tsx             # Spillover board: ladder history, pathway grid, countries, base rates
│   ├── incidents/page.tsx         # Monthly chart since 2022 plus explorer (last 365 days)
│   ├── incidents/[year]/page.tsx  # Explorer for one year
│   ├── strikes/page.tsx           # Deep-strike log
│   ├── indicators/page.tsx        # Warning indicators by tier
│   ├── forecasts/page.tsx         # Open and resolved forecasts, Brier summary
│   ├── methodology/page.tsx       # Definitions rendered from lib/vocab.ts, plus method prose
│   └── feed.xml/route.ts          # RSS 2.0 of the last 30 briefs (force-static)
├── components/
│   ├── layout/                    # Nav, Footer, PageHeader, SampleBanner
│   ├── brief/                     # BriefView and its sections (§6)
│   ├── incidents/                 # IncidentExplorer (client), IncidentRow
│   ├── strikes/                   # StrikeTable
│   ├── charts/                    # LineChart, MonthlyBars, HeatGrid (server SVG)
│   └── ui/                        # RungBadge, ProbabilityBadge, ScoreBadge, AttributionBadge,
│                                  # VerificationBadge, TrendArrow, Tag
├── lib/
│   ├── vocab.ts                   # Every controlled vocabulary, label and definition (§4.2)
│   ├── schema/                    # Zod schemas (§4.3 to §4.10); index.ts re-exports
│   │   ├── common.ts              # ProbabilityEstimate, Source, EvidenceSource, ids
│   │   ├── draft-brief.ts         # DraftBrief (agent output)
│   │   ├── brief.ts               # Brief (published)
│   │   ├── incident.ts            # Incident, IncidentsFile
│   │   ├── strike.ts              # Strike, StrikesFile
│   │   ├── state.ts               # State, Indicator, Assumption
│   │   ├── forecast.ts            # Forecast, ForecastsFile
│   │   ├── misc.ts                # CorrectionsFile, ArchiveIndex
│   │   ├── pack.ts                # Source pack and source registry
│   │   └── context.ts             # AgentContext
│   ├── rules/                     # Cross-field validation rules (§4.11), one file per group
│   ├── validate.ts                # validateDraft(), validatePublished(), validateAll()
│   ├── aggregate.ts               # Computed rung, counts, baselines, floors, monthly series, Brier
│   ├── content.ts                 # Build-time loaders reading ET_CONTENT_DIR (default "content")
│   ├── context.ts                 # buildContext(): the AgentContext from content/ (§4.14)
│   ├── apply.ts                   # Merging incident and strike updates into records
│   ├── json-schema.ts             # Renders the agent's JSON Schema from DraftBrief
│   ├── text.ts                    # countWords()
│   ├── probability.ts             # Bands, term checks
│   ├── dates.ts                   # taipeiToday(), windowFor(), isMonday(), addDays(), Kyiv helpers
│   └── urls.ts                    # normalizeUrl(), stripArchivePrefix()
├── content/                       # Published data; only the pipeline pushes here directly
│   ├── briefs/YYYY-MM-DD.json     # One published brief per day
│   ├── incidents/YYYY.json        # Incident database, one file per year
│   ├── strikes/YYYY.json          # Deep-strike log, one file per year
│   ├── state.json                 # Current scores, indicators, assumptions
│   ├── forecasts.json             # Every forecast
│   ├── corrections.json           # Public corrections log (edited by PR)
│   └── archive-index.json         # URL → Wayback snapshot
├── research/
│   ├── sources.yaml               # Source registry: feeds, channels, queries, domain map
│   ├── seed/                      # Phase 4 seed records as YAML (npm run seed:build → content/)
│   └── packs/                     # (gitignored) daily source packs: YYYY-MM-DD.json/.md
├── routine/
│   ├── TASK.md                    # Prompt of the Claude app's scheduled task (written in Phase 0)
│   ├── PROMPT.md                  # Research-and-draft prompt (template; written in Phase 0)
│   ├── REPAIR.md                  # Repair prompt (template; written in Phase 0)
│   ├── STYLE.md                   # Analytic standards; binding for the agent (Phase 0)
│   ├── agent-settings.json        # Phase 3: permissions for the headless agent (§8.5)
│   └── schema/draft-brief.schema.json  # Generated from Zod; CI checks it is current
├── scripts/
│   ├── daily.sh                   # Entry point the scheduled task runs: env, caffeinate, daily.ts
│   ├── daily.ts                   # Orchestrator (§7.2)
│   ├── preflight.ts               # Arch, lock, network, git checks
│   ├── collect.ts                 # Source pack builder (§7.3)
│   ├── build-context.ts           # drafts/context.json (§7.4)
│   ├── validate.ts                # CLI (§7.5)
│   ├── publish.ts                 # Apply draft → content, commit, push (§7.6)
│   ├── promote.ts                 # Supervised mode: move review/DATE onto main
│   ├── archive-urls.ts            # Wayback snapshots, background (§7.8)
│   ├── score-forecasts.ts         # Brier report (§7.9)
│   ├── gen-json-schema.ts         # Zod → routine/schema/draft-brief.schema.json
│   ├── agent-check.ts             # One-turn smoke test of the headless agent
│   └── lib/                       # log.ts, run.ts (child processes with timeouts), git.ts,
│                                  # keychain.ts, transcript.ts (§7.10), lock.ts, summary.ts (§7.7),
│                                  # agent.ts (the agent's flags and environment, §8.4)
├── fixtures/
│   ├── briefs/valid-weekday.json, valid-monday.json, valid-quiet.json
│   ├── briefs/invalid--<CODE>.json # One per validation rule, ≥ 15 files
│   ├── context/*.json             # Contexts matching the brief fixtures
│   ├── evidence/*.json            # Evidence sets for SOURCE_UNSEEN tests
│   ├── src/                       # Builds the brief, context and evidence fixtures (npm run fixtures:gen)
│   ├── collect/                   # Saved RSS/Telegram HTML samples for collector tests
│   ├── agent/                     # A real CLI transcript and fake-claude.mjs for the pipeline tests
│   ├── empty-content/             # The pre-seed placeholder content, for the end-to-end tests
│   └── site-content/              # Coherent SAMPLE dataset for previews (§9 Phase 2)
├── tests/                         # Vitest: *.test.ts
├── drafts/                        # (gitignored) agent output and context
├── logs/                          # (gitignored) run logs, transcripts, evidence, runs.jsonl
├── needs-review/                  # (gitignored) failed drafts with reports
├── .github/workflows/
│   └── ci.yml                     # Typecheck, tests, validate:all, schema:check, build (no alert workflows)
├── package.json, package-lock.json, tsconfig.json, next.config.ts, postcss.config.mjs,
├── vitest.config.ts, .gitignore
```

`.gitignore` must include: `node_modules/`, `.next/`, `drafts/`, `logs/`, `needs-review/`,
`research/packs/`, `.env*`, `.vercel/`, `*.tsbuildinfo`, `.DS_Store`.

---

## 4. Data

### 4.1 Conventions

- All content is JSON: UTF-8, 2-space indentation, a trailing newline, and keys in the order defined
  here. `publish.ts` writes with a stable key order so diffs stay readable.
- Dates are `YYYY-MM-DD`. Timestamps are ISO 8601 with an offset, for example
  `2026-11-03T05:30:00+08:00`.
- Every top-level content file has `"schema_version": 1`.
- **Every key is required.** Absent values are `null` or `[]`, never missing. The agent fills every
  key, which matches strict JSON Schema. Use `z.strictObject`, so unknown keys are errors.
- **Words** means `countWords()` in `lib/text.ts`. It strips URLs and markdown symbols, splits on
  whitespace, and counts non-empty tokens. Hyphenated words and numbers each count as one word.
- **Characters** limits (marked "chars") count JavaScript string length.
- The Zod schemas in `lib/schema/` are the single source of truth. The validator, the site loaders and
  `routine/schema/draft-brief.schema.json` (generated by `z.toJSONSchema`) all derive from them.

### 4.2 Vocabularies (`lib/vocab.ts`)

Implement exactly these constants. The methodology page renders from them, so labels must read well.

```ts
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
export const COUNTRY_NAMES: Record<CountryCode | (typeof THREAT_LOCATIONS)[number], string>; // English short names

export const COUNTRY_SCORES = {
  1: { label: "Low",      anchor: "No incident affecting the country at rung 2 or above in 30 days, and no active strategic indicator naming it" },
  2: { label: "Guarded",  anchor: "Rung-1 activity affecting it in 30 days (jamming, balloons, migration pressure)" },
  3: { label: "Elevated", anchor: "A rung-2 or rung-3 incident affecting it in 30 days" },
  4: { label: "High",     anchor: "A rung-4 incident affecting it in 30 days, or an active strategic indicator naming it" },
  5: { label: "Severe",   anchor: "Direct conflict (rung 5 or above) involving it" },
} as const;

export const SEAS = ["baltic", "black_sea", "north_sea", "barents_norwegian", "mediterranean", "other"] as const;

// Incident types per pathway, with the allowed rung range. "other" is allowed in every pathway with
// range 1–6, and produces a warning. `serious: true` marks a type that meets its pathway's serious
// threshold by definition: every maritime attack on or seizure of a vessel.
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
    vessel_seizure:        { label: "Vessel seized by force",      min: 3, max: 4, serious: true },
    mine_drift:            { label: "Drifting mine or stray sea drone", min: 1, max: 4 },
    strike_at_sea:         { label: "Strike on a vessel in European waters", min: 3, max: 4, serious: true },
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
```

### 4.3 Shared types (`lib/schema/common.ts`)

```ts
interface ProbabilityEstimate {
  probability: number;        // integer 0–100; must lie inside PROBABILITY_TERMS[term]
  term: ProbabilityTerm;
  confidence: "low" | "moderate" | "high";
}

interface Source {            // a source cited in a brief
  id: string;                 // "s1", "s2", … unique in the brief (regex ^s[1-9][0-9]*$)
  title: string;              // ≤ 200 chars
  outlet: string;             // ≤ 80 chars, e.g. "Reuters", "Ukrainian Air Force (Telegram)"
  category: SourceCategoryId;
  url: string;                // https; never news.google.com; must be in the evidence set (SOURCE_UNSEEN)
  language: string;           // ISO 639-1, e.g. "en", "uk", "ru", "pl"
  published_at: string | null;// ISO timestamp if known
  accessed_at: string;        // ISO timestamp
}

interface EvidenceSource {    // a source stored on an incident, strike or forecast resolution
  title: string;              // ≤ 200 chars
  outlet: string;             // ≤ 80 chars
  category: SourceCategoryId;
  url: string;                // https
  published_at: string | null;
}

type Impact = 1 | 2 | 3 | 4 | 5;
type Score = 1 | 2 | 3 | 4 | 5;
```

Id formats:
- Incident `^INC-\d{4}-\d{4}$`, where the year is the year of the incident `date`.
- Strike `^STR-\d{4}-\d{4}$`.
- Forecast `^F-\d{4}-\d{3}$`, where the year is the year the forecast was opened.
- Correction `^C-\d{4}$`.
- Assumption `^A\d+$`.
- Indicator `^ind-[a-z0-9-]+$`.
- Development `^d[1-9][0-9]*$`.

### 4.4 DraftBrief: agent output at `drafts/YYYY-MM-DD.json`

```ts
interface DraftBrief {
  schema_version: 1;
  date: string;                    // Taipei date of the run; equals the file name
  window: { start: string; end: string };  // end = `${date}T05:30:00+08:00`; start = end − 24 h
  generated_at: string;            // ISO timestamp when the agent wrote the file
  quiet_day: boolean;              // true when fewer than 3 material developments
  weekly: boolean;                 // true when `date` is a Monday; then weekly_outlook is required
  title: string;                   // ≤ 140 chars
  bottom_line: string;             // 40–120 words
  bottom_line_source_ids: string[];// ≥ 2 ids spanning ≥ 2 source categories

  board: {
    ladder: {
      current_rung: Rung;          // must equal the computed rung (§4.11 RUNG_COMPUTED)
      previous_rung: Rung;         // must equal state.ladder.current_rung
      next_rung_odds: ProbabilityEstimate | null; // 30-day P(any incident at rung ≥ current+1); null only when current_rung = 6
      rationale: string;           // ≤ 60 words
    };
    pathways: PathwayScore[];      // exactly 7, in PATHWAYS order
    countries: CountryScore[];     // the 7 TIER1 countries in TIER1 order, then optional TIER2 entries touched today
  };

  developments: Development[];     // 3–8 (quiet day 0–3); at most one "pivotal"
  categories: CategoryNote[];      // exactly 12, in CATEGORIES order

  incidents_new: Incident[];       // full records (§4.6); ids continue context.next_ids
  incident_updates: IncidentUpdate[];
  strikes_new: Strike[];           // full records (§4.7)
  strike_updates: StrikeUpdate[];

  indicator_changes: IndicatorChange[]; // status changes only
  indicators_new: IndicatorNew[];       // rare

  judgement: {
    text: string;                  // 150–400 words (quiet day 60–250)
    change_my_mind: string;        // ≤ 50 words
    competing_explanations: CompetingExplanation[]; // 0–2
  };

  forecasts_new: ForecastNew[];          // 0–3
  forecast_updates: ForecastUpdate[];    // 0–10
  forecast_resolutions: ForecastResolution[];
  assumption_updates: AssumptionUpdate[];

  taiwan: string;                  // "Impact on Taiwan", 1–150 words: how today's developments might affect Taiwan (STYLE.md §14); the no-news line is valid
  next_72h: NextEvent[];           // 0–8
  weekly_outlook: WeeklyOutlook | null; // non-null iff weekly
  metrics: Metric[];               // each MetricId at most once
  sources: Source[];               // ≥ 10 from ≥ 7 categories (quiet day ≥ 5 from ≥ 4)
}

interface PathwayScore {
  pathway: PathwayId;
  serious_odds: ProbabilityEstimate; // 30-day P(≥ 1 serious incident in this pathway)
  impact: Impact;                    // consequence if it happens (IMPACT_LABELS)
  trend: "up" | "down" | "flat";     // vs state: up if probability rose ≥ 5 points, down if it fell ≥ 5
  rationale: string;                 // ≤ 40 words: base rate plus reason for any change
  source_ids: string[];              // ≥ 1 when |change| ≥ 15 points
}

interface CountryScore {
  country: CountryCode;              // TIER1 required; TIER2 optional
  score: Score;
  previous_score: Score | null;      // state value for TIER1; null for TIER2
  reason: string | null;             // ≤ 40 words; required when score ≠ previous_score or score > floor
  source_ids: string[];              // ≥ 1 when score ≠ previous_score
  indicator_ids: string[];           // active strategic indicators naming this country
  cohesion_flag: boolean;            // only HU or SK may be true
}

interface Development {
  id: string;                        // "d1", "d2", …
  headline: string;                  // ≤ 140 chars
  summary: string;                   // 20–80 words
  category: CategoryId;
  importance: "pivotal" | "major" | "notable";
  incident_ids: string[];            // incidents (new or existing) it is about
  strike_ids: string[];              // strikes (new or existing) it is about
  verification: 1 | 2 | 3 | 4 | 5 | null; // required when strike_ids non-empty: max verification among them
  attribution: 1 | 2 | 3 | 4 | null; // required when incident_ids non-empty: max attribution among them
  russian_framing: string | null;    // ≤ 40 words, as a claim
  source_ids: string[];              // ≥ 1; pivotal/major ≥ 2 spanning ≥ 2 categories
}

interface CategoryNote {
  category: CategoryId;
  status: "material" | "no_change";
  text: string;                      // material: ≤ 60 words; no_change: exactly "No material change."
  development_ids: string[];
  source_ids: string[];              // ≥ 1 when material
}

interface IncidentUpdate {
  id: string;                        // existing incident (not one in incidents_new)
  changes: {
    attribution: 1 | 2 | 3 | 4 | null;
    attribution_note: string | null;
    rung: 1 | 2 | 3 | 4 | 5 | 6 | null;
    serious: boolean | null;
    casualties: { killed: number; injured: number } | null;
    disruption_hours: number | null;
    summary: string | null;
    host_statement: "yes" | "none_yet" | null; // "yes" once the affected government or agency has spoken
  };                                 // null = unchanged; at least one non-null
  add_sources: EvidenceSource[];     // ≥ 1 when attribution, rung or host_statement changes
  reason: string;                    // ≤ 40 words
}

interface StrikeUpdate {
  id: string;
  changes: {
    verification: 1 | 2 | 3 | 4 | 5 | null;
    damage: string | null;
    effect: string | null;
    summary: string | null;
    weapon_detail: string | null;
    western_weapon: boolean | null;
  };
  add_sources: EvidenceSource[];     // ≥ 1 when verification changes
  reason: string;                    // ≤ 40 words
}

interface IndicatorChange { id: string; to: "dormant" | "watch" | "active"; evidence: string; /* ≤ 50 words */ source_ids: string[]; /* ≥ 1 */ }
interface IndicatorNew {
  id: string; tier: "incident" | "strategic" | "driver"; name: string; /* ≤ 80 chars */
  description: string; /* ≤ 50 words */ countries: CountryCode[]; status: "dormant" | "watch" | "active";
  evidence: string; /* ≤ 50 words */ source_ids: string[];
}

interface CompetingExplanation {
  subject: string;                   // ≤ 20 words, e.g. "INC-2026-0131: drones over Rzeszów"
  hypotheses: { label: string; /* ≤ 12 words */ assessment: string; /* ≤ 40 words */ estimate: ProbabilityEstimate }[]; // 2–4
}

interface ForecastNew {
  id: string;                        // context.next_ids.forecast, then +1
  question: string;                  // ≤ 200 chars, binary, ends with "?"
  resolution_criteria: string;       // ≤ 300 chars, observable
  resolves_by: string;               // after `date`, at most 400 days later
  horizon: "30d" | "90d" | "6-12m" | "2-5y";
  pathway: PathwayId | null;
  probability: number;               // integer 1–99
  base_rate: number;                 // integer 0–100: what a forecaster using only history would say
  base_rate_note: string;            // ≤ 40 words
}
interface ForecastUpdate { id: string; probability: number; /* 1–99 */ note: string; /* ≤ 30 words */ }
interface ForecastResolution { id: string; outcome: "yes" | "no" | "annulled"; note: string; /* ≤ 40 words */ source_id: string; }

interface AssumptionUpdate {
  op: "add" | "revise" | "retire" | "reaffirm";
  id: string | null;                 // null only for "add" (publish assigns the next A#)
  text: string | null;               // required for add and revise, ≤ 40 words
  reason: string;                    // ≤ 40 words
}

interface NextEvent { date: string; /* in (date, date+3 days] */ event: string; /* ≤ 25 words */ why: string; /* ≤ 25 words */ }

interface WeeklyOutlook {
  medium_term: { question: string; estimate: ProbabilityEstimate; text: string }; // 6–12 months; text ≤ 200 words
  long_term:   { question: string; estimate: ProbabilityEstimate; text: string }; // 2–5 years; text ≤ 200 words
  assumptions_check: { id: string; status: "holds" | "weakening" | "broken"; note: string /* ≤ 30 words */ }[]; // every active assumption
  calibration_note: string;          // ≤ 80 words
}

interface Metric {
  id: MetricId;
  value: number | null;              // null = not available today
  unit: string;                      // must equal METRICS[id].unit
  period: string;                    // ≤ 40 chars, e.g. "night of 1–2 Nov", "2 Nov"
  source_ids: string[];              // ≥ 1 when value ≠ null
  note: string | null;               // ≤ 20 words
}
```

**Total words.** `TOTAL_WORDS` is the sum of words in these fields:
- `bottom_line`, `board.ladder.rationale`, every pathway `rationale`, every country `reason`
- every development `summary` and `russian_framing`, and every category `text`
- every `incidents_new` `summary` and `attribution_note`
- every `strikes_new` `summary`, `damage` and `effect`
- every indicator change `evidence`
- `judgement.text`, `judgement.change_my_mind`, and the competing-explanation `assessment`s
- `taiwan`, and every `next_72h` `event` and `why`

Limits: 600–2,000 words, or 250–2,000 on a quiet day. Not counted: `weekly_outlook`, `sources`,
`forecasts_*`, update `reason`s, `title`s and `headline`s (those have character limits).

### 4.5 Brief: published at `content/briefs/YYYY-MM-DD.json`

```ts
interface Brief extends DraftBrief {
  weekly_outlook: (WeeklyOutlook & {
    assumptions_check: { id: string; status: "holds" | "weakening" | "broken"; note: string; text: string }[];
  }) | null;                         // publish.ts adds each assumption's text as the brief assessed it
  published_at: string;              // ISO timestamp set by publish.ts
  computed: {
    pathways: Record<PathwayId, { incidents_30d: number; baseline_monthly: number }>;
    word_count: number;              // TOTAL_WORDS
    source_count: number;
    source_category_count: number;
  };
}
```

### 4.6 Incident: `content/incidents/YYYY.json`

The file is `{ "schema_version": 1, "year": 2026, "incidents": Incident[] }`, sorted by `date`, then `id`.

```ts
interface Incident {
  id: string;                        // INC-YYYY-NNNN, YYYY = year of `date`
  date: string;                      // local date of occurrence
  date_precision: "day" | "month";   // "month" only when seed = true (date = the 1st)
  location_country: CountryCode | "BY" | "RU" | "UA"; // BY/RU/UA only for military_pressure and nuclear
  affected: CountryCode[];           // ≥ 1 European countries affected (includes location_country if European)
  location: string | null;           // ≤ 80 chars: city, region or sea area
  sea: "baltic" | "black_sea" | "north_sea" | "barents_norwegian" | "mediterranean" | "other" | null;
  pathway: PathwayId;
  type: string;                      // key of INCIDENT_TYPES[pathway], or "other"
  rung: 1 | 2 | 3 | 4 | 5 | 6;
  serious: boolean;                  // meets PATHWAY_INFO[pathway].serious
  summary: string;                   // ≤ 60 words, factual
  attribution: 1 | 2 | 3 | 4;
  attribution_note: string | null;   // ≤ 40 words: who suspects or attributes
  host_statement: "yes" | "none_yet";// has the affected government or agency spoken?
  casualties: { killed: number; injured: number };
  disruption_hours: number | null;   // e.g. hours an airport was closed
  sources: EvidenceSource[];         // rules: INCIDENT_SOURCES
  seed: boolean;                     // true for Phase 4 seed records
  added: string;                     // date added
  updated: string | null;            // date of last update
}
```

Example:

```json
{
  "id": "INC-2026-0131",
  "date": "2026-11-02",
  "date_precision": "day",
  "location_country": "PL",
  "affected": ["PL"],
  "location": "Lublin Voivodeship",
  "sea": null,
  "pathway": "airspace",
  "type": "drone_incursion",
  "rung": 3,
  "serious": false,
  "summary": "Poland's Operational Command said two Russian drones crossed from Ukraine during an overnight attack on Volyn; one was shot down and debris fell in a field near Hrubieszów. No injuries.",
  "attribution": 3,
  "attribution_note": "Polish Operational Command identified the drones as Russian Geran types.",
  "host_statement": "yes",
  "casualties": { "killed": 0, "injured": 0 },
  "disruption_hours": 2,
  "sources": [
    { "title": "Komunikat Dowództwa Operacyjnego", "outlet": "Polish Operational Command", "category": "eu_gov_security", "url": "https://www.wojsko-polskie.pl/dorsz/...", "published_at": "2026-11-02T06:10:00+01:00" },
    { "title": "Russian drone shot down over eastern Poland", "outlet": "Notes from Poland", "category": "eu_regional_press", "url": "https://notesfrompoland.com/...", "published_at": "2026-11-02T09:30:00+01:00" }
  ],
  "seed": false,
  "added": "2026-11-03",
  "updated": null
}
```

(This is an illustrative format sample, not a real event. Never put it in `content/`.)

### 4.7 Strike: `content/strikes/YYYY.json`

The file is `{ "schema_version": 1, "year": 2026, "strikes": Strike[] }`, sorted by `date`, then `id`.

```ts
interface Strike {
  id: string;                        // STR-YYYY-NNNN
  date: string;                      // Kyiv date of the strike; for night strikes, the date the night began
  target_name: string;               // ≤ 100 chars, e.g. "Ryazan oil refinery"
  target_type: StrikeTargetType;
  region: string;                    // Russian region or occupied area, ≤ 60 chars
  occupied_territory: boolean;
  lat: number | null;
  lon: number | null;
  distance_km: number | null;        // approximate distance from nearest Ukraine-controlled territory
  weapon: "drone" | "missile" | "sea_drone" | "sabotage" | "unknown";
  weapon_detail: string | null;      // ≤ 40 chars
  western_weapon: boolean | null;    // null = unknown
  verification: 1 | 2 | 3 | 4 | 5;
  damage: string | null;             // ≤ 30 words; required at verification ≥ 4
  effect: string | null;             // ≤ 30 words; required at verification 5
  summary: string;                   // ≤ 50 words
  sources: EvidenceSource[];         // rules: STRIKE_EVIDENCE
  seed: boolean;
  added: string;
  updated: string | null;
}
```

### 4.8 State: `content/state.json`

```ts
interface State {
  schema_version: 1;
  as_of: string;                     // date of last applied brief, or "seed"
  ladder: { current_rung: Rung; next_rung_odds: ProbabilityEstimate | null };
  pathways: { pathway: PathwayId; serious_odds: ProbabilityEstimate; impact: Impact; trend: "up" | "down" | "flat" }[]; // 7, PATHWAYS order
  countries: { country: (typeof TIER1)[number]; score: Score; since: string }[];  // 7, TIER1 order
  indicators: Indicator[];
  assumptions: Assumption[];
  weekly: {
    as_of: string;
    medium_term: { question: string; estimate: ProbabilityEstimate };
    long_term: { question: string; estimate: ProbabilityEstimate };
  } | null;
}

interface Indicator {
  id: string;                        // ind-…
  tier: "incident" | "strategic" | "driver";
  name: string;                      // ≤ 80 chars
  description: string;               // ≤ 50 words
  countries: CountryCode[];          // countries it names ([] = Europe-wide)
  status: "dormant" | "watch" | "active";
  since: string;                     // date status last changed
  last_evidence: string | null;      // ≤ 50 words
  last_evidence_date: string | null;
}

interface Assumption {
  id: string;                        // A1, A2, …
  text: string;                      // ≤ 40 words
  since: string;
  status: "active" | "retired";
  retired_on: string | null;
  retired_reason: string | null;
}
```

The starting indicators and assumptions are in Appendix B. Phase 4 sets their real statuses.

### 4.9 Forecasts: `content/forecasts.json`

The file is `{ "schema_version": 1, "forecasts": Forecast[] }`, sorted by `id`.

```ts
interface Forecast {
  id: string; question: string; resolution_criteria: string; resolves_by: string;
  horizon: "30d" | "90d" | "6-12m" | "2-5y"; pathway: PathwayId | null;
  probability: number;               // at open
  base_rate: number; base_rate_note: string;
  opened: string;
  updates: { date: string; probability: number; note: string }[];
  status: "open" | "resolved_yes" | "resolved_no" | "annulled";
  resolved_on: string | null;
  resolution_note: string | null;
  resolution_source: EvidenceSource | null;
  brier: number | null;              // (p_last/100 − outcome)², outcome 1 = yes, 0 = no; null if open or annulled
  brier_base: number | null;         // same formula with base_rate
}
```

`p_last` is the probability in the last update, or the opening probability if there are no updates.

### 4.10 Corrections and archive index

- `content/corrections.json` is
  `{ "schema_version": 1, "corrections": { id, date, target: { kind: "brief" | "incident" | "strike" | "forecast"; id: string }, description /* ≤ 60 words */ }[] }`.
  It is edited by hand through PRs, never by the daily agent in v1.
- `content/archive-index.json` is
  `{ "schema_version": 1, "urls": Record<normalizedUrl, { snapshot: string; at: string }> }`.
  Only `publish.ts` writes it, merging in `logs/archive-index.pending.json` (§7.8).

### 4.11 Validation rules

`lib/rules/` implements each rule as a pure function returning `ValidationIssue[]`:

```ts
interface ValidationIssue { code: string; severity: "error" | "warning"; path: string; message: string; hint: string | null }
```

Messages must tell the agent exactly how to fix the problem, for example "computed rung is 3; set
board.ladder.current_rung to 3".

Computed values used by the rules come from `lib/aggregate.ts` (§7.4). They use the incident database
plus the draft's `incidents_new` and `incident_updates`, with the window "last 30 days" = dates in
`[date − 29 days, date]`.

| Code | Rule | Severity |
|---|---|---|
| SCHEMA | Zod parse failure; report every issue with its path | error |
| DATE_MISMATCH | `date` differs from the file name or the run date | error |
| WINDOW_MISMATCH | `window` differs from `windowFor(date)` | error |
| WEEKLY_FLAG | `weekly` differs from `isMonday(date)`, or `weekly_outlook` null/non-null doesn't match it | error |
| WORDS_OVER, WORDS_UNDER | A per-field budget (§4.4) or the TOTAL_WORDS range is broken; message gives the count and the limit | error |
| PROB_TERM | A probability lies outside its term's band | error |
| ORDER_PATHWAYS | `board.pathways` isn't exactly the 7 PATHWAYS in order | error |
| ORDER_COUNTRIES | The 7 TIER1 countries are missing or out of order, a duplicate exists, or a non-TIER1/TIER2 country appears | error |
| ORDER_CATEGORIES | `categories` isn't exactly the 12 CATEGORIES in order | error |
| RUNG_COMPUTED | `ladder.current_rung` ≠ the max rung of incidents in the last 30 days (0 if none) | error |
| RUNG_PREVIOUS | `ladder.previous_rung` ≠ `state.ladder.current_rung` | error |
| NEXT_ODDS_NULL | `next_rung_odds` is null while `current_rung` < 6 | error |
| TREND | A pathway trend doesn't match its change against state (±5 points) | error |
| PATHWAY_JUMP_SOURCES | Change of 15 points or more without `source_ids` | error |
| COUNTRY_FLOOR | Score below the floor. The floor comes from incidents in the last 30 days whose `affected` includes the country: none → 1, max rung 1 → 2, rung 2–3 → 3, rung 4 → 4, rung ≥ 5 → 5 | error |
| COUNTRY_CEILING | Score above floor + 1 without an active strategic indicator in `indicator_ids` that names the country | error |
| COUNTRY_REASON | Missing `reason` when score ≠ previous or score > floor; missing `source_ids` when changed | error |
| COUNTRY_PREVIOUS | TIER1 `previous_score` ≠ state | error |
| COHESION_FLAG | `cohesion_flag` true for a country other than HU or SK | error |
| DEV_COUNT | Developments outside 3–8 (quiet day 0–3) | error |
| PIVOTAL_MAX | More than one pivotal development | error |
| DEV_SOURCES | A pivotal or major development has fewer than 2 sources or fewer than 2 categories | error |
| DEV_LADDER | `strike_ids` without `verification`, `incident_ids` without `attribution`, an unknown id, or a value that doesn't equal the max of the referenced records | error |
| CATEGORY_TEXT | A `no_change` text isn't exactly "No material change.", or a `material` note has no `source_ids` | error |
| SOURCE_REF | A referenced source id doesn't exist | error |
| SOURCE_DUP | Duplicate source id, or duplicate normalized URL | error |
| SOURCE_URL | URL isn't https, is malformed, or is on news.google.com | error |
| SOURCE_MIN | Fewer than 10 sources or 7 categories (quiet day: 5 and 4) | error |
| SOURCE_SIDES | A non-quiet brief lacks a `ua_gov` source or a `ru_gov`/`ru_state_media` source | error |
| SOURCE_UNSEEN | A normalized source URL isn't in the evidence set: pack URLs ∪ URLs the agent fetched ∪ URLs in its search and fetch results. A Wayback snapshot of an evidence URL counts. Skipped with a warning when no evidence file is given | error |
| SOURCE_ORPHAN | A source is never referenced | warning |
| BOTTOM_LINE_SOURCES | `bottom_line_source_ids` has fewer than 2 ids or fewer than 2 categories | error |
| ID_FORMAT, ID_SEQUENCE, ID_DUPLICATE | A new id is malformed, doesn't continue `context.next_ids` without gaps, or collides with an existing one | error |
| INCIDENT_TYPE | `type` isn't in INCIDENT_TYPES[pathway] (`other` gives a warning only) | error |
| INCIDENT_RUNG | Rung outside the type's range; `killed > 0` with rung < 4; a BY/RU/UA location with rung > 1 | error |
| INCIDENT_LOCATION | A BY/RU/UA location in a pathway other than military_pressure or nuclear; `affected` empty; a European `location_country` missing from `affected` | error |
| INCIDENT_SERIOUS | Rung ≥ 4 or `killed > 0` but `serious` is false; or a type that meets its pathway's threshold by definition (`serious: true` in `INCIDENT_TYPES`: a maritime strike on or seizure of a vessel) but `serious` is false. Updates are checked on the merged record | error |
| INCIDENT_SOURCES | For non-seed incidents: ≥ 2 sources from ≥ 2 categories. If `host_statement` is "yes", one must be `eu_gov_security` or `nato_eu`; if "none_yet", attribution must be ≤ 2. Seeds need ≥ 1 source. Updates to non-seed incidents are checked on the merged record: attribution above 2 needs `host_statement` "yes", and an update that sets it must cite the statement in `add_sources` | error |
| INCIDENT_PRECISION | `date_precision` is "month" on a non-seed incident | error |
| UPDATE_TARGET | An update references an unknown id, or one in today's `*_new` | error |
| UPDATE_EVIDENCE | An attribution, rung, host-statement or verification change has no `add_sources`, or a strike's new level lacks its evidence | error |
| STRIKE_EVIDENCE | A verification level lacks its evidence. Level 2 needs a `ru_gov` or `ru_state_media` source. Level 3 needs `osint_data`. Level 4 needs `damage` plus an `intl_press` or `osint_data` source. Level 5 needs `effect` plus a `markets_energy`, `intl_press` or `ru_gov` source | error |
| INDICATOR_CHANGE | Unknown id, or `to` equals the current status | error |
| INDICATOR_NEW | Id already exists, or the format is wrong | error |
| FORECAST_NEW | More than 3 new; question doesn't end in "?"; `resolves_by` out of range; probability outside 1–99 | error |
| FORECAST_OPEN_CAP | Open forecasts would exceed 30 | error |
| FORECAST_REF | An update or resolution targets an unknown or non-open forecast, or the resolution's `source_id` is unknown | error |
| ASSUMPTION_REF | Retire, revise or reaffirm targets an unknown or retired id, or an add/revise has no text | error |
| WEEKLY_ASSUMPTIONS | `assumptions_check` doesn't list exactly the active assumptions | error |
| NEXT72_DATE | A `next_72h` date outside (date, date + 3 days] | error |
| METRIC_UNIT, METRIC_DUP, METRIC_SOURCE | Wrong unit, duplicate id, or a value without sources | error |
| TAIWAN_EMPTY | `taiwan` is empty | error |
| RECORD_FIELDS | A new incident or strike is dated after the brief date, or has `seed: true` (errors); `added` isn't the brief date or `updated` isn't null (warnings: `publish.ts` sets both) | error / warning |

Some codes also cover close relatives: `COUNTRY_CEILING` flags `indicator_ids` that aren't active
strategic indicators naming the country; `DEV_LADDER` flags an `attribution` or `verification` set
without referenced records; `UPDATE_TARGET` flags updates that change nothing or repeat an id;
`INDICATOR_CHANGE` and `INDICATOR_NEW` need at least one source; `FORECAST_REF` warns when a forecast
resolves "no" before its `resolves_by` date.

`validateAll()` (`npm run validate:all`) checks every content file against its schema (`SCHEMA`), every
published brief with `validatePublished()` (the rules that don't need the previous day's state), plus
these cross-file rules:
- `XREF_ID_DUP`: ids are unique across all files
- `XREF_ID_YEAR`: each incident or strike id's year matches its date and its file
- `XREF_UNRESOLVED`: every id referenced in any brief, and every correction target, resolves
- `FILE_ORDER`: incident and strike files are sorted by date then id; forecasts by id
- `FILE_NAME`: brief files are named `YYYY-MM-DD.json`, and the name matches `date` (`DATE_MISMATCH`)
- `STATE_SHAPE`: the state has the 7 pathways and 7 tier-1 countries in order, and unique indicator and
  assumption ids
- `COMPUTED_MISMATCH`: a brief's `computed` counts, and every forecast's stored Brier scores, match what
  the code computes

### 4.12 Source registry: `research/sources.yaml`

```yaml
schema_version: 1
domains:                 # outlet domain → source category, used to classify keyword-query results
  reuters.com: intl_press
  apnews.com: intl_press
  notesfrompoland.com: eu_regional_press
  tass.com: ru_state_media
  # … at least 80 domains covering all 15 categories
keywords:                # ranking boosts, matched case-insensitively in titles and snippets, any language
  - drone
  - airspace
  - sabotage
  - дрон
  - dron
  # … ≥ 60 terms across English, Ukrainian, Russian, Polish, Lithuanian, Latvian, Estonian, Finnish, Romanian, German
feeds:
  - id: ua-air-force
    name: Ukrainian Air Force
    kind: telegram       # telegram | rss | gnews
    channel: kpszsu      # → https://t.me/s/kpszsu
    category: ua_gov
    language: uk
    coverage: [russian_strikes, airspace]
    priority: 1          # 1 high, 2 normal, 3 low
  - id: kyiv-independent
    name: Kyiv Independent
    kind: rss
    url: https://kyivindependent.com/news-archive/rss/
    category: ua_independent
    language: en
    coverage: [battlefield, russian_strikes, diplomacy, deep_strikes]
    priority: 2
  - id: q-airspace-pl
    name: "Google News: drones in Polish airspace (pl)"
    kind: gnews
    query: "dron przestrzeń powietrzna"
    hl: pl
    gl: PL
    coverage: [airspace]
    priority: 2
```

Requirements for the Phase 3 list:
- 60–90 feeds in total.
- Every one of the 12 coverage categories has at least 3 feeds or queries.
- Every TIER1 country has at least one query in its own language.
- Russian official sources go through Telegram channels, because many Russian state sites block foreign
  visitors.
- **Verify** every entry with `npm run sources:check`, and drop or replace dead ones.

Candidates to verify (names, not guaranteed URLs):
- **Telegram:** `kpszsu`, `GeneralStaffZSU`, `mod_russia`, `DeepStateUA`, `vvgladkov`, `avbogomaz`,
  `astrapress`, `rybar`, `tass_agency`.
- **RSS:** Kyiv Independent, Ukrainska Pravda (English), Meduza (English), The Moscow Times,
  Notes from Poland, ERR News, LRT English, LSM English, Yle News, TVP World, Digi24, NewsMaker,
  Euromaidan Press, ISW, NATO news, IAEA, TASS English, BBC Europe, Euronews, The Record (cyber),
  UK Defence Journal, Defense News, Militarnyi.
- **Google News queries** (`https://news.google.com/rss/search?q=<q>+when:1d&hl=<hl>&gl=<GL>&ceid=<GL>:<lang>`):
  queries per pathway in several languages.

### 4.13 Source pack: `research/packs/YYYY-MM-DD.json` and `.md`

```ts
interface Pack {
  schema_version: 1; date: string; window: { start: string; end: string }; generated_at: string;
  degraded: boolean;                 // true when ≥ 40% of feeds failed
  feeds: { id: string; ok: boolean; items_total: number; items_kept: number; error: string | null }[];
  items: PackItem[];                 // ≤ 350, sorted by score desc
}
interface PackItem {
  id: string;                        // "p0001"…
  feed_id: string; outlet: string;
  category: SourceCategoryId | "unclassified";
  language: string; coverage: CategoryId[];
  title: string;                     // ≤ 200 chars
  url: string;                       // original link (Google News items keep the redirect link)
  lead_only: boolean;                // true for gnews items: the agent must open the original article before citing
  published_at: string;
  snippet: string;                   // ≤ 300 chars
  score: number;
}
```

The `.md` version is what the agent reads:
- A header with the window, the degraded flag and the failed feeds.
- Then 12 sections in CATEGORIES order. An item appears under each category it covers.
- One line per item: `- [p0042] 02 Nov 21:14 · Ukrainian Air Force (ua_gov, uk) · <title> — <snippet> · <url>`.

### 4.14 Agent context: `drafts/context.json` (built by `scripts/build-context.ts`)

```ts
interface AgentContext {
  date: string;
  window: { start: string; end: string };
  weekly: boolean;
  deadline: string;                  // ISO timestamp by which the draft must be written
  state: State;
  computed: {
    current_rung: Rung;              // from incidents in the last 30 days (before today's additions)
    pathways: Record<PathwayId, { incidents_30d: number; baseline_monthly: number; serious_12m: number; monthly_avg_since_2022: number }>;
    countries: Record<(typeof TIER1)[number], { max_rung_30d: number; floor: Score }>;
    incidents_last_30d: Pick<Incident, "id" | "date" | "affected" | "pathway" | "type" | "rung" | "attribution" | "summary">[];
  };
  next_ids: { incident: Record<string, string>; strike: Record<string, string>; forecast: string };
                                     // incident/strike keyed by year: current and previous year
  open_forecasts: Forecast[];
  recent_briefs: { date: string; title: string; bottom_line: string; judgement: string }[]; // last 3
  recent_strikes: Strike[];          // last 14 days
  active_assumptions: Assumption[];
  pack: { md: string; json: string; degraded: boolean; failed_feeds: string[] };
}
```

`baseline_monthly` = incidents dated in `[date − 119, date − 30]` divided by 3, to one decimal place.
`monthly_avg_since_2022` = incidents since 2022-02-24 divided by the number of months elapsed.

---

## 5. Routes

Every route is statically generated at build time. There are no API routes and no runtime data
fetching.
- Use `generateStaticParams` with `dynamicParams = false` for `[date]` and `[year]`.
- In Next.js 16, `params` is a Promise. Await it.
- Route handlers use `export const dynamic = "force-static"`.

| Route | File | Shows |
|---|---|---|
| `/` | `app/page.tsx` | Latest brief via `BriefView`. Empty state: "The first brief arrives at about 06:15 Taipei." |
| `/brief/[date]` | `app/brief/[date]/page.tsx` | `BriefView`, plus previous and next links |
| `/archive` | `app/archive/page.tsx` | Table: date, title, rung badge, next-rung odds, quiet and weekly badges |
| `/board` | `app/board/page.tsx` | Ladder history (step line over all briefs), next-rung odds line, pathway heat grid (last 30 briefs), tier-1 country table with change history, base-rate table (per pathway: last 30 days, baseline monthly, average since Feb 2022, serious in the last 12 months) |
| `/incidents` | `app/incidents/page.tsx` | Stacked monthly bars by pathway since 2022-02; `IncidentExplorer` over the last 365 days; links to year pages |
| `/incidents/[year]` | `app/incidents/[year]/page.tsx` | `IncidentExplorer` for that year |
| `/strikes` | `app/strikes/page.tsx` | Monthly strike counts, verification mix, `StrikeTable` (last 180 days) |
| `/indicators` | `app/indicators/page.tsx` | Indicators grouped by tier: status badge, since, last evidence |
| `/forecasts` | `app/forecasts/page.tsx` | Open forecasts (question, current probability, base rate, resolves by); resolved forecasts (outcome, Brier); summary (n, mean Brier, mean base-rate Brier) |
| `/methodology` | `app/methodology/page.tsx` | Renders from `lib/vocab.ts`: rungs, pathways and thresholds, both ladders, probability scale, country anchors, categories, source categories. Adds short prose on method, data counting rules (from STYLE.md §4), and the corrections log |
| `/feed.xml` | `app/feed.xml/route.ts` | RSS 2.0 of the last 30 briefs: title, link, pubDate, and description = bottom line |

Page titles come from `generateMetadata`. Open Graph tags use the title and bottom line (text only; no
OG images in v1).

---

## 6. Components

Everything is a server component except `IncidentExplorer`.
- Styling is Tailwind utilities on top of the tokens in Appendix A.
- Layout is mobile-first: one column, `max-w-3xl`, readable at 375 px wide.
- Color is never the only signal; every badge also carries text.

```ts
// components/brief/BriefView.tsx — the whole brief, sections in this order:
// Header (title, date, window, quiet/weekly badges) → BottomLine → SpilloverBoard (LadderGauge,
// PathwayTable, CountryTable) → KeyDevelopments → NewIncidents (+ incident updates) → DeepStrikes
// (new strikes + updates) → CategoryNotes (12 compact rows) → IndicatorChanges → Judgement (+ competing
// explanations, change my mind) → Forecasts (new, updated, resolved) → Impact on Taiwan → WeeklyOutlook (Mondays)
// → Next72h → Metrics → Sources
interface BriefViewProps {
  brief: Brief;
  incidentsById: Record<string, Incident>;
  strikesById: Record<string, Strike>;
  forecastsById: Record<string, Forecast>;
  archive: Record<string, string>;   // normalized URL → snapshot URL
  prevDate: string | null;
  nextDate: string | null;
}

interface LadderGaugeProps { current: Rung; previous: Rung; nextOdds: ProbabilityEstimate | null; compact?: boolean }
// Seven stacked segments (0–6) with rung colors and names; current marked; previous shown if different;
// next-rung odds as a ProbabilityBadge beside the next rung.

interface PathwayTableProps { pathways: PathwayScore[]; computed: Brief["computed"]["pathways"] }
// Rows: pathway label · incidents 30 d vs baseline (e.g. "4 vs 1.3/mo") · serious odds badge · impact ·
// trend arrow · rationale.

interface CountryTableProps { countries: CountryScore[] }       // flag-free; name, ScoreBadge, change, reason
interface DevelopmentCardProps { development: Development; sourcesById: Record<string, Source> }
interface SourceListProps { sources: Source[]; archive: Record<string, string> } // numbered; outlet, category label, language, link, "archived" link when present

interface RungBadgeProps { rung: Rung; size?: "sm" | "md" }
interface ProbabilityBadgeProps { estimate: ProbabilityEstimate; showConfidence?: boolean } // "Unlikely · 30% · moderate"
interface ScoreBadgeProps { score: Score }
interface AttributionBadgeProps { level: 1 | 2 | 3 | 4 }
interface VerificationBadgeProps { level: 1 | 2 | 3 | 4 | 5 }
interface TrendArrowProps { trend: "up" | "down" | "flat" }

// components/charts — pure SVG, server-rendered, viewBox-based so they scale. Each takes
// ariaLabel and renders a <details> data table beneath for screen readers.
interface LineChartProps {
  series: { name: string; points: { x: string; y: number }[] }[]; // x = YYYY-MM-DD
  yMin?: number; yMax?: number; yTicks?: number[]; step?: boolean; height?: number; ariaLabel: string;
}
interface MonthlyBarsProps { months: { month: string; counts: Partial<Record<PathwayId, number>> }[]; ariaLabel: string } // stacked, legend
interface HeatGridProps {
  rows: { key: string; label: string }[];
  columns: string[];                 // dates
  cells: Record<string, Record<string, { term: ProbabilityTerm; title: string } | null>>; // rowKey → col → cell
  ariaLabel: string;
}

// components/incidents/IncidentExplorer.tsx ("use client")
interface IncidentExplorerProps { incidents: Incident[] }
// Filters: pathway, country (affected), minimum rung, minimum attribution, text search. Newest first.
// Shows the match count. Each row: date, country names, pathway, type label, RungBadge,
// AttributionBadge, summary, source links.
```

`app/layout.tsx` contains:
- **Nav:** EuropeTracker wordmark; Today, Board, Incidents, Strikes, Indicators, Forecasts, Archive,
  Method.
- **Footer:** "Updated daily at about 06:15 Taipei", RSS, Methodology, corrections.
- **SampleBanner:** shown when `ET_CONTENT_DIR` isn't `content`, reading "Sample data for layout
  testing — not real reporting".

---

## 7. Scripts

### 7.1 package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:sample": "ET_CONTENT_DIR=fixtures/site-content next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "validate": "tsx scripts/validate.ts",
    "validate:all": "tsx scripts/validate.ts --all",
    "schema:gen": "tsx scripts/gen-json-schema.ts",
    "schema:check": "tsx scripts/gen-json-schema.ts --check",
    "fixtures:gen": "tsx fixtures/src/build.ts",
    "sources:check": "tsx scripts/collect.ts --check-feeds",
    "collect": "tsx scripts/collect.ts",
    "context": "tsx scripts/build-context.ts",
    "daily": "tsx scripts/daily.ts",
    "publish": "tsx scripts/publish.ts",
    "promote": "tsx scripts/promote.ts",
    "archive-urls": "tsx scripts/archive-urls.ts",
    "forecasts:report": "tsx scripts/score-forecasts.ts --report",
    "agent:check": "tsx scripts/agent-check.ts"
  }
}
```

### 7.2 `scripts/daily.ts`: the orchestrator

`scripts/daily.sh` is the entry point the scheduled task runs (§8.3):

```zsh
#!/bin/zsh
export PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
export TZ=Asia/Taipei
cd /Users/kobol/Projects/EuropeTracker || exit 1
mkdir -p logs
exec /usr/bin/caffeinate -i /opt/homebrew/bin/npx --no-install tsx scripts/daily.ts "$@"
```

**Flags**
- `--date YYYY-MM-DD`: default is today in Taipei.
- `--dry-run`: no git writes and no notifications; prints a summary.
- `--review`: supervised mode. Pushes to branch `review/DATE` instead of `main` and prints the Vercel
  preview link.
- `--force`: runs even if today's brief exists.
- `--no-deadline`: for manual runs; the deadline becomes start + 75 minutes.
- `--simulate-failure`: forces a validation failure, to test the failure path.
- `--detach`: re-launches itself in the background (`nohup`) and exits 0 at once. Only the two-task
  fallback in §8.3 uses it.

**Constants** (overridable by env, §8.7): `HARD_STOP = 06:55`, `RETRY_CUTOFF = 06:25`,
`AGENT_TIMEOUT_MAX = 45 min`, `REPAIR_TIMEOUT = 6 min`, `MAX_REPAIRS = 2`, `LIVE_WAIT_MAX = 8 min`,
`PUBLISH_RESERVE = 4 min` (kept free after the last repair for publishing and the live check).

**Sequence.** Every step logs to `logs/DATE.daily.log` with timestamps.

1. **Preflight** (`preflight.ts`). Any failure ends the run with a code: `E_ARCH`, `E_LOCK`, `E_NET`,
   `E_GIT`, `E_AUTH`.
   - `process.arch === "arm64"`.
   - Lock: `logs/.lock` holds `{pid, started}`. If it exists and the pid is alive, exit 0 quietly
     (another run is going). If it is stale (dead pid, or older than 2 hours), remove it and log that.
   - Network: HEAD `https://github.com` within 10 s.
   - Git: `git status --porcelain` is empty. `GIT_TERMINAL_PROMPT=0 git ls-remote --heads origin main`
     succeeds. `git checkout main`, then sync with GitHub: `git fetch origin main` and
     `git rebase origin/main`. Local commits GitHub lacks may only touch `content/` (briefs whose push
     failed); anything else, or a conflict, is `E_GIT`.
   - If `content/briefs/DATE.json` already exists and `--force` isn't set: when GitHub's main has it,
     exit 0 (idempotent); when only this clone has it (an earlier push failed), push it (§7.6), wait
     for the page and end as published, without running the agent.
   - The Claude binary exists at `ET_CLAUDE_BIN`, and the keychain token is readable (§8.6).
2. **Collect.** Run `collect.ts` with a 4-minute timeout. On failure, continue with `degraded = true`
   and an empty pack.
3. **Context.** Run `build-context.ts`, which writes `drafts/context.json`.
4. **Agent attempt.** Render `routine/PROMPT.md` (§10) and run the agent (§8.4) with
   `timeout = min(AGENT_TIMEOUT_MAX, HARD_STOP − now − 10 min)`.
   - Stream to `logs/DATE.agent-N.jsonl`.
   - Extract `session_id` and the evidence set into `logs/DATE.evidence.json` (§7.10).
   - The deadline written into the prompt is `start + timeout − 5 min`.
5. **Validate** the draft with the context, the evidence and the pack (`lib/validate.ts`).
   - On errors, run up to `MAX_REPAIRS` repairs. Each repair resumes the session
     (`claude -p --resume <session_id>`) with `routine/REPAIR.md` and the errors JSON, under
     `REPAIR_TIMEOUT`, and ends `PUBLISH_RESERVE` before `HARD_STOP`; when there is less room than
     2 minutes, skip it. Re-validate after each one.
6. **Retry.** If the agent failed (non-zero exit, timeout, no draft) or the draft still fails
   validation:
   - If this was attempt 1 and it's before `RETRY_CUTOFF`, start attempt 2 with a fresh session and go
     back to step 4.
   - Otherwise take the failure path.
7. **Publish** (skipped with `--dry-run`).
   - Run `publish.ts` (§7.6) with a deadline of `HARD_STOP − 30 s`: no git command runs past it, and
     push retries stop rather than wait past it. A push still failing then is `E_PUBLISH`, and the
     committed brief goes out with the next publish or run.
   - Poll `ET_SITE_URL/brief/DATE` every 20 s for up to `min(LIVE_WAIT_MAX, HARD_STOP − 30 s − now)`
     until it returns 200. If it times out, the summary says "not yet live"; that is a warning, not a
     failure.
   - Spawn `archive-urls.ts` detached.
8. **Failure path.**
   - Copy `drafts/DATE.json`, `drafts/context.json`, the validator report, the logs and the pack
     summary into `needs-review/DATE/`.
   - Exit 1.
9. **Always** (in `finally`):
   - Write the run summary (§7.7) to `logs/DATE.summary.md` and print it as the final block on stdout.
   - Release the lock.
   - Append one line to `logs/runs.jsonl`:
     `{date, started, ended, outcome: "published"|"failed"|"skipped"|"dry_run", attempts, repairs, sources, words, error_code, duration_s}`.
   - Delete files older than 60 days in `logs/`, `drafts/` and `research/packs/`.
     Leave `needs-review/` alone.

### 7.3 `scripts/collect.ts`

- Reads `research/sources.yaml` (validated with `lib/schema/pack.ts`). Writes
  `research/packs/DATE.json` and `DATE.md`.
- **Fetching:** concurrency 8, 15 s timeout per feed, 1 retry, 3-minute total cap. User-Agent
  `EuropeTracker/1.0 (+https://europetracker.vercel.app)`.
- `rss` feeds: parse with `rss-parser`. Keep `title`, `link`, `isoDate` and `contentSnippet`.
- `telegram` feeds: GET `https://t.me/s/<channel>` and parse with cheerio. Each message is
  `.tgme_widget_message`:
  - text from `.tgme_widget_message_text` (whitespace collapsed)
  - time from `time[datetime]`
  - permalink from `a.tgme_widget_message_date[href]`
  - title = the first 120 chars of the text, snippet = the first 300.
  - **Verify** these selectors in Phase 3 against a saved page, stored in `fixtures/collect/`.
    Done 2026-11-02: the live pages match. `fixtures/collect/telegram.html` keeps the real markup with
    invented text. A reply's quoted text sits inside `.tgme_widget_message_reply` and is skipped.
- `gnews` queries: build the URL in §4.12 and parse as RSS.
  - The outlet comes from `<source url=…>`; the category comes from the `domains` map, else
    "unclassified".
  - Set `lead_only: true`.
- **Window:** keep items published in `[window.start − 6 h, window.end]`. Drop undated items. A date
  without a time zone takes the zone of the channel's own date, else UTC, never Kobol's local time.
- **Dedupe:** first by normalized URL, then by title similarity (lowercase, punctuation stripped,
  Jaccard ≥ 0.8 on word sets). Keep the item from the higher-priority feed.
- **Score:** `10 × (4 − priority)` + `3 × min(keyword hits, 5)` + recency bonus 0–5 (newer is higher)
  + 4 if the category is `ua_gov`, `ru_gov`, `eu_gov_security` or `nato_eu`.
- **Caps:** top 30 per coverage category, 350 unique items overall.
- **Exit codes:** 0 on success, including degraded. 1 if the config is invalid or zero items were kept.
- `--check-feeds`: fetch every feed and print a table of id, status, item count and newest date. The
  status is `FAIL` if the feed didn't load and `NODATE` if it has items but none with a readable date
  (they would all be dropped). Exit 1 if any priority-1 feed is `FAIL` or `NODATE`.

### 7.4 `scripts/build-context.ts` and `lib/aggregate.ts`

`lib/aggregate.ts` exports pure functions that the site, validator and context all use:

- `computedRung(incidents, asOf): Rung`
- `pathwayCounts(incidents, asOf): Record<PathwayId, { incidents_30d: number; baseline_monthly: number; serious_12m: number; monthly_avg_since_2022: number }>`
- `countryFloors(incidents, asOf): Record<CountryCode, { max_rung_30d: number; floor: Score }>`
- `monthlyCounts(incidents): { month: string; counts: Partial<Record<PathwayId, number>> }[]`
- `brier(forecast): { brier: number | null; brier_base: number | null }`
- `brierSummary(forecasts): { n: number; mean_brier: number | null; mean_brier_base: number | null }`
- `nextIds(incidents, strikes, forecasts, date)`

`build-context.ts --date D` assembles the `AgentContext` (§4.14) from `content/` and the pack, and
writes `drafts/context.json`.

### 7.5 `scripts/validate.ts`

```
tsx scripts/validate.ts <draft.json> [--context <context.json>] [--evidence <evidence.json>]
                        [--pack <pack.json>] [--published] [--json]
tsx scripts/validate.ts --all
```

- The default mode validates a DraftBrief. `--published` validates a published Brief.
- Without `--context`, it builds the context from `content/` for the draft's date, and checks
  references against every record in `content/`. With `--context`, the context is the whole world:
  references resolve only against the records it carries.
- `--json` prints `{ ok, errors: ValidationIssue[], warnings: ValidationIssue[] }`. Without it, the
  output is human-readable.
- Exit code: 0 ok, 1 errors, 2 usage or IO error.

### 7.6 `scripts/publish.ts`

`publish.ts --date D [--review]` takes these steps:

0. Refuse unless the repo is on `main` and `content/` has no uncommitted changes. Sync with GitHub as
   preflight does (§7.2). If `content/briefs/D.json` exists: when GitHub's main has it, abort ("already
   exists"); when only this clone has it, an earlier push failed, so push it (step 5) and stop.
1. Load `drafts/D.json` and validate it in full, with context and evidence. Abort on errors.
2. Build the `Brief`: the draft plus `published_at` plus `computed` (counts from `aggregate.ts` after
   adding today's incidents; word and source counts).
3. Apply to an in-memory copy of `content/`:
   - Append `incidents_new` to `incidents/<year>.json`, creating the file if missing. Sort.
   - Apply `incident_updates`: merge the non-null `changes`, append `add_sources`, set `updated = D`.
   - Do the same for strikes.
   - **Forecasts:** add new ones (`opened = D`, `updates = []`, `status = "open"`). Apply updates by
     pushing `{date: D, probability, note}`. Apply resolutions: set status, `resolved_on = D` and the
     note; set `resolution_source` from the brief's source with that id; set `brier` and `brier_base`.
   - **State:** `as_of = D`.
     - ladder from the board
     - pathways from the board, without rationale and sources
     - TIER1 countries, with `since = D` when the score changed
     - indicators: apply each change (status, `since = D`, last evidence and date); append new ones
     - assumptions: an add gets the next A# and `since = D`; a revise sets the text and `since`; a
       retire sets the status, `retired_on` and the reason; a reaffirm changes nothing
     - weekly, from `weekly_outlook` when present
   - **Archive index:** merge `logs/archive-index.pending.json` if it exists, then delete it after the
     commit.
4. Run `validateAll()` on the in-memory result. Abort on errors.
5. Write the files with stable key order. Then:
   - `git add content/`
   - `git commit -m "brief: D — <title>"` (author from the repo's git config, §8.9)
   - `git push origin main`, retrying 3 times with 2 s, 4 s and 8 s backoff. Before each try, sync with
     GitHub again; if that rebased the brief onto newer commits, run `validateAll()` again first.
   - Report success only after `git fetch` shows GitHub's main includes the commit.
6. With `--review`, commit to the new branch `review/D` and push that instead. `promote.ts --date D`
   later runs `git checkout main && git merge --ff-only review/D && git push origin main`, then deletes
   the branch locally and on the remote.

### 7.7 Run summary (`scripts/lib/summary.ts`)

There are no alerts; that was JL's decision. Instead, every run, whatever its outcome, ends with a short
Markdown summary.
- `daily.ts` writes it to `logs/DATE.summary.md` and prints it as the final block on stdout.
- The scheduled task (§8.3) replies with it, so it appears in the Claude app as that morning's update.
- At most 15 lines, plain words.

Published:

```markdown
**EuropeTracker DATE — published**
Rung N (Name) · next-rung odds: Term (P%) · live at <url>   ← or "committed, not yet live"
Bottom line: <the brief's bottom line, verbatim>
Changes: <up to 3 short lines: score changes, new incidents, indicator changes>
Run: started HH:MM, finished HH:MM · attempts A, repairs R · S sources from C categories · W words
```

Failed:

```markdown
**EuropeTracker DATE — failed** (E_CODE)
What happened: <one sentence>
First errors: <up to 5 validator codes with their messages>
Draft and logs: needs-review/DATE/
Next step: <one line, e.g. "rerun: npm run daily -- --no-deadline", or "the Claude login token needs renewing (SPEC §8.6)">
```

- **Skipped** (the brief already exists, or another run holds the lock): one line saying so.
- **Dry run:** the published format, headed "dry run", plus the draft path.
- The summary never contains tokens, environment values, or anything but the brief's own text and the
  run facts.

### 7.8 `scripts/archive-urls.ts`

This runs detached after publish.
- For each source URL in today's brief that isn't in `content/archive-index.json` or the pending file,
  GET `https://web.archive.org/save/<url>`: 20 s timeout, 15 s apart, at most 30 URLs.
- On 200 or 302, record `https://web.archive.org/web/<timestamp>/<url>` (from `Content-Location` or the
  final URL) in `logs/archive-index.pending.json`.
- The next day's `publish.ts` merges the pending file into `content/archive-index.json`. That keeps the
  working tree clean between runs. Failures are just logged.

### 7.9 `scripts/score-forecasts.ts`

`--report` prints open forecasts and resolved ones with Brier and base-rate Brier, plus the means.
Scoring itself happens in `publish.ts` through `aggregate.brier()`.

### 7.10 `scripts/lib/transcript.ts`

- Parses the agent's `stream-json` log.
  - The `session_id` comes from the first `system`/`init` event.
  - Fetched URLs come from `tool_use` blocks named `WebFetch` (`input.url`).
  - Every `http(s)://` URL found in `tool_result` content counts, which covers search results and
    fetched pages.
- Evidence set = pack item URLs ∪ fetched URLs ∪ result URLs, all normalized
  (`lib/urls.ts normalizeUrl`).
- **Normalization:**
  - lower-case the host, strip `www.`, drop the fragment and trailing slash
  - remove `utm_*`, `fbclid` and `gclid` parameters
  - treat http and https as the same
  - treat `t.me/s/<c>/<n>` and `t.me/<c>/<n>` as the same
  - strip a `web.archive.org/web/<ts>/` prefix
- Writes `logs/DATE.evidence.json`: `{ "urls": string[] }`.
- **Verify** the event shapes against the installed CLI's real output in Phase 3, and keep a trimmed
  real transcript in `fixtures/` for tests. Done 2026-11-02 for a sign-in failure
  (`fixtures/agent/transcript-auth-failed.jsonl`); `fixtures/agent/fake-claude.mjs` emits the same
  event shapes for the end-to-end test.

---

## 8. Deployment and operations

### 8.1 Vercel

- **Create the project in Phase 2.** Use the Vercel connector's `create_git_project` with
  repo `8gara8/EuropeTracker`, teamId `team_xxXFmwmVsAfTU86OFG8fcX3S`, projectName `europetracker`
  and `deploy: false`. Use the dashboard if the connector isn't available.
  - If linking fails because the repository can't be reached, JL adds EuropeTracker to the Vercel
    GitHub App's repository access at github.com/settings/installations.
  - **Done 2026-11-02:** project `prj_TK8CGmlI0RAbrinn7XZgARy4jl77`.
- **Framework and build:** Next.js preset, build command `next build`, Node 26.x (Vercel's default),
  production branch `main`. No `vercel.json`.
- **Ignored Build Step:** `[ ! -d app ]`, so commits without the site (such as Phase 1 on its own)
  are skipped instead of failing a production build.
- **Environment variables:**
  - Preview: `ET_CONTENT_DIR=fixtures/site-content`. Previews of `review/DATE` branches ignore it and
    build from `content/` (`contentDir()` in `lib/site.ts` checks `VERCEL_GIT_COMMIT_REF`), so the
    supervised review shows the real brief.
  - Production: `ET_SITE_URL=https://<production domain>`.
- **Protection:** the team default (Vercel Authentication on previews) is fine. The production domain
  must be publicly reachable. Check it with `curl -I` after the first production deploy.

### 8.2 GitHub Actions

`.github/workflows/ci.yml` (added in Phase 1 without the build step, which Phase 2 adds):

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run validate:all
      - run: npm run schema:check
      - run: npm run build
```

There are no alert or watchdog workflows, by design (§0.2, §7.7).

### 8.3 Scheduled task in the Claude app (the daily trigger)

- **What:** a scheduled task in the Claude desktop app on Kobol, the same mechanism MEtracker uses.
  - Name: "Europe tracker morning".
  - Schedule: daily at 05:30 Asia/Taipei (cron `30 5 * * *`), set to run on this computer.
  - Working folder: `/Users/kobol/Projects/EuropeTracker`.
  - Prompt: the contents of `routine/TASK.md`.
- **What it does:** runs `zsh scripts/daily.sh` in the background, ends its turn until the app wakes
  it when the command finishes, then replies with `logs/DATE.summary.md`. That reply is JL's morning
  update in the Claude app. The task session runs nothing else and never reads web content; research
  happens in the sandboxed headless sub-process (§8.4).
- **Creating it** (Phase 5, with JL present):
  1. Create the task with the scheduled-tasks tool, or in the app.
  2. A task created by the tool takes the creating session's folder and starts in Manual permission
     mode, so set the folder to `/Users/kobol/Projects/EuropeTracker` on the task page.
  3. Click Run now once while JL watches, and approve the
     `zsh /Users/kobol/Projects/EuropeTracker/scripts/daily.sh` command as "Always allowed" (reading
     the summary needs no approval: it's inside the task's folder). Later unattended runs then never
     stall on a permission prompt.
  4. Confirm the saved folder (`cwd`) in
     `~/Library/Application Support/Claude/claude-code-sessions/*/*/scheduled-tasks.json`.
- **Finding it:** the app's Scheduled page hides tasks Claude set up from a project; click Show beside
  "N hidden tasks that Claude set up in Slack, a project or Claude Code".
- **Verified in Phase 5 (4 November):**
  - **Start-time jitter.** The app delays this task by a fixed 7 minutes, so it starts at 05:37 every
    day. `daily.ts` sizes its timeouts from the actual start, so even a 05:43 start finishes by 06:55.
  - **Long background commands.** The task started the pipeline in the background, ended its turn,
    and was woken when the pipeline exited 7.5 minutes later. If a later app version can't do that,
    fall back to two tasks: one at 05:30 runs
    `zsh scripts/daily.sh --detach` (returns at once), and one at 06:56 replies with the summary file.
- **Requirements:** the Claude desktop app is running and Kobol is awake and logged in, the same as
  MEtracker's task.
- **Don't** create, change or reschedule any other task, MEtracker's included.

### 8.4 Claude Code CLI (headless research agent)

- **Install the native build in its own folder:**
  `/opt/homebrew/bin/npm install --prefix /Users/kobol/.europetracker/cli @anthropic-ai/claude-code@2.1.316`.
  The binary is `/Users/kobol/.europetracker/cli/node_modules/.bin/claude` (`ET_CLAUDE_BIN`).
  - Not `npm install -g`: npm's global prefix on Kobol is `~/.npm-global`, which comes first on the
    PATH, so a global install would replace JL's own `claude`.
  - Check: `file -L` on the binary must report arm64 (it did on 2026-11-02).
  - Never use `~/.local/bin/claude`, which is an Intel build from March 2026.
- **Isolated config dir:** `CLAUDE_CONFIG_DIR=/Users/kobol/.europetracker/claude`, created with mode
  700. This keeps JL's plugins, MCP servers, hooks and memory out of the pipeline.
- **Auth:** the OAuth token from `claude setup-token` (§8.6), passed only to the agent process as
  `CLAUDE_CODE_OAUTH_TOKEN`.
- **Invocation:** built by `daily.ts`. The working directory is the repo root and the env is minimal:
  `HOME`, `PATH`, `TZ`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_OAUTH_TOKEN`, `DISABLE_AUTOUPDATER=1`.

```
$ET_CLAUDE_BIN -p "<rendered PROMPT.md>" \
  --model "${ET_MODEL:-opus}" --fallback-model "${ET_FALLBACK_MODEL:-sonnet}" \
  --output-format stream-json --verbose \
  --restricted --safe-mode \
  --tools WebSearch,WebFetch,Read,Glob,Grep,Write,Edit \
  --settings routine/agent-settings.json \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --permission-mode dontAsk --permission-prompts none \
  --allowedTools "WebSearch" "WebFetch" "Read" "Glob" "Grep" "Write(drafts/**)" "Edit(drafts/**)" \
  --disallowedTools "Bash" "Task" "NotebookEdit"
```

Verified against `claude --help` for 2.1.316 (2026-11-02):
- `--max-turns` no longer exists; the agent timeout bounds the run instead.
- `--restricted` removes every tool that runs commands or code, confines the file tools to the working
  directory, and ignores user, project and local settings files. `--safe-mode` turns off CLAUDE.md,
  skills, plugins, hooks, custom agents and MCP servers. `--tools` is the complete list of built-in
  tools that exist in the session. With `--permission-mode dontAsk` and `--permission-prompts none`,
  anything not allowed is denied without a prompt.
- `--bare` is not used: it accepts only API keys, not the OAuth token.
- The CLI exits 0 even when sign-in fails. A run's outcome is the final `{"type":"result"}` event's
  `is_error` (its `subtype` says "success" either way), plus whether the draft exists.
- `scripts/lib/agent.ts` builds these arguments; the prompt comes first because the allow and deny
  lists are variadic.

- **Repair:** the same flags plus `--resume <session_id>`, with the rendered REPAIR.md as the prompt.
- **Verify** every flag and its exact syntax with `claude --help` for the installed version, and adapt.
  The intent is fixed: no MCP servers, no shell, web research allowed, writes only inside `drafts/`.
- `npm run agent:check` runs a one-turn prompt ("Reply OK") with this exact setup. It prints the CLI
  version, the model in use, and whether auth worked.

### 8.5 Agent sandbox (`routine/agent-settings.json`)

```json
{
  "permissions": {
    "allow": ["WebSearch", "WebFetch", "Read", "Glob", "Grep", "Write(drafts/**)", "Edit(drafts/**)"],
    "deny": ["Bash", "Task", "NotebookEdit",
             "Write(content/**)", "Edit(content/**)", "Write(scripts/**)", "Edit(scripts/**)",
             "Write(routine/**)", "Edit(routine/**)", "Read(.git/**)"]
  },
  "env": { "DISABLE_AUTOUPDATER": "1" }
}
```

Don't put these restrictions in `.claude/settings.json`, because coding sessions in this repo would
inherit them.

**Verify the sandbox in Phase 3 with tests** (a throwaway prompt through `agent:check`):
1. Asking it to read `/Users/kobol/.ssh/known_hosts` is denied.
2. Asking it to write `content/x.json` is denied.
3. Asking it to run `ls` is denied.
4. Writing `drafts/test.json` works.

Record the results in the PR.

### 8.6 Credentials (JL does these; the coding agent never sees the values)

Everything lives in JL's login keychain on Kobol. `scripts/lib/keychain.ts` reads with
`security find-generic-password -s <service> -w`.

| Service name | What | How JL creates it |
|---|---|---|
| `europetracker-claude-oauth` | Claude Code OAuth token for the agent | In Terminal on Kobol: `CLAUDE_CONFIG_DIR=$HOME/.europetracker/claude $HOME/.europetracker/cli/node_modules/.bin/claude setup-token`, then `security add-generic-password -U -a kobol -s europetracker-claude-oauth -w` and paste the token at the prompt (twice) |

`gh` already has a keyring login as 8gara8 with `repo` and `workflow` scopes. Git pushes over HTTPS use
the same credentials.

### 8.7 Environment variables (non-secret; defaults in code)

| Variable | Default | Used by |
|---|---|---|
| `ET_CONTENT_DIR` | `content` | Site loaders and scripts (Vercel Preview sets `fixtures/site-content`; `review/DATE` previews use `content/`) |
| `ET_SITE_URL` | `https://europetracker.vercel.app` | Live check, RSS links, metadata |
| `ET_MODEL` | `opus` | Agent model alias |
| `ET_CLAUDE_BIN` | `/Users/kobol/.europetracker/cli/node_modules/.bin/claude` | daily.ts |
| `ET_FALLBACK_MODEL` | `sonnet` | Agent fallback when the main model is overloaded |
| `ET_LIVE_WAIT_MS` | 8 minutes | How long publish waits for the brief to go live (tests set 0) |
| `ET_ARCHIVE` | on | `0` skips the background Wayback requests (tests) |
| `ET_CLAUDE_CONFIG_DIR` | `/Users/kobol/.europetracker/claude` | daily.ts |
| `ET_HARD_STOP` | `06:55` | daily.ts |
| `ET_RETRY_CUTOFF` | `06:25` | daily.ts |

There are no `.env` files with secrets. Tokens come only from the keychain.

### 8.8 Logs

`logs/` holds:
- `DATE.daily.log`: human-readable
- `DATE.agent-N.jsonl`: agent transcripts
- `DATE.evidence.json`
- `runs.jsonl`
- `DATE.summary.md`: the run summary the scheduled task replies with (§7.7)
- `archive-index.pending.json`

`logs/`, `drafts/` and `research/packs/` keep 60 days. `needs-review/` is kept until JL clears it.
`docs/RUNBOOK.md` explains how to read each file.

### 8.9 One-time setup on Kobol (Phase 3, plus Phase 5 for the scheduled task)

1. The repo is already cloned at `/Users/kobol/Projects/EuropeTracker`. Its git config has
   `user.name = 8gara8` and `user.email = 62337733+8gara8@users.noreply.github.com`.
2. `/opt/homebrew/bin/npm ci`.
3. Install the native Claude CLI (§8.4) and create the isolated config dir.
4. JL creates the keychain items (§8.6).
5. `npm run agent:check`, then the sandbox tests (§8.5).
6. In Phase 5: create the scheduled task in the Claude app (§8.3).

---

## 9. Phased build plan

Every phase:
- runs on its own branch and ends in a PR with the milestone output pasted in
- passes CI before merge
- never pushes production content (`content/briefs/`) before Phase 5

### Phase 1: Contract (schemas, validator, fixtures, tests)

**Goal:** The data contract exists and is enforced. Every later phase builds against it.

**Tasks**
1. Initialize the project:
   - `package.json` with the exact versions in §2 and the scripts in §7.1
   - `tsconfig.json` (strict, `"paths": { "@/*": ["./*"] }`), `vitest.config.ts`, `.gitignore`
2. `lib/vocab.ts`, exactly as in §4.2, plus `COUNTRY_NAMES`.
3. `lib/text.ts` (`countWords`), `lib/probability.ts` (`termFor`, `inBand`, `inGap`), `lib/dates.ts`
   (`taipeiToday`, `windowFor`, `isMonday`, `addDays`, `daysBetween`) and `lib/urls.ts`
   (`normalizeUrl`, `stripArchivePrefix`).
4. `lib/schema/*`: Zod schemas for every interface in §4.3 to §4.14, using `z.strictObject` and
   explicit nulls. Export the inferred types.
5. `lib/aggregate.ts`, as in §7.4.
6. `lib/rules/*` and `lib/validate.ts`: every rule in §4.11.
7. `scripts/validate.ts` (§7.5) and `scripts/gen-json-schema.ts`. The latter writes
   `routine/schema/draft-brief.schema.json`; `--check` fails if the file is stale.
8. Initial `content/`:
   - `state.json` as a placeholder. Use Appendix B's indicators and assumptions, all indicators
     `dormant`; ladder 0 with `next_rung_odds` remote 5% low; every pathway remote 5% low, impact 1,
     flat; every country score 1; `as_of: "seed"`.
   - Empty `incidents/2026.json` and `strikes/2026.json`.
   - `forecasts.json`, `corrections.json` and `archive-index.json`, all empty.
9. Fixtures:
   - Three valid drafts (weekday, Monday weekly, quiet day), each with a matching context and evidence
     file, written as realistic but clearly labelled samples ("SAMPLE" in the title).
   - At least 15 invalid drafts named `invalid--<CODE>.json`, covering at least WORDS_OVER, PROB_TERM,
     ORDER_PATHWAYS, RUNG_COMPUTED, TREND, COUNTRY_FLOOR, COUNTRY_CEILING, PIVOTAL_MAX, DEV_SOURCES,
     SOURCE_MIN, SOURCE_SIDES, SOURCE_UNSEEN, INCIDENT_SOURCES, STRIKE_EVIDENCE, ID_SEQUENCE,
     WEEKLY_FLAG and SCHEMA (unknown key).
10. Tests:
    - every valid fixture passes
    - every invalid fixture fails with exactly its expected code among the errors
    - unit tests for `countWords`, the probability bands, `windowFor`, `isMonday`, `normalizeUrl`,
      `computedRung`, `pathwayCounts`, `countryFloors`, `nextIds` and `brier`

**Milestone**
```
/opt/homebrew/bin/npm ci && npm run typecheck && npm test && npm run validate:all && npm run schema:check
npm run validate -- fixtures/briefs/valid-weekday.json --context fixtures/context/weekday.json --evidence fixtures/evidence/weekday.json   # exit 0
for f in fixtures/briefs/invalid--*.json; do npm run -s validate -- "$f" --context fixtures/context/weekday.json --evidence fixtures/evidence/weekday.json --json; done   # each exit 1 with its code
```

### Phase 2: Site and Vercel

**Goal:** Every page renders with sample data on a Vercel preview, and with empty production content
without errors.
**Depends on:** Phase 1.

**Tasks**
1. Next.js app (`next.config.ts`, `postcss.config.mjs`, `app/globals.css` with Appendix A tokens),
   `lib/content.ts` loaders that validate with Zod at load and read `ET_CONTENT_DIR`.
2. Components in §6 and routes in §5, including RSS and the methodology page rendered from
   `lib/vocab.ts`.
3. `fixtures/site-content/`, a coherent SAMPLE dataset:
   - 10 consecutive daily briefs, including one Monday and one quiet day
   - about 40 incidents across 2024–2026 covering all 7 pathways
   - about 15 strikes, a matching state, and 8 forecasts (3 resolved)
   - every title starting "SAMPLE —"
4. `.github/workflows/ci.yml`.
5. Create the Vercel project (§8.1) and set the Preview env var.

**Milestone**
- `npm run build` passes with `ET_CONTENT_DIR=content` (empty states) and with
  `ET_CONTENT_DIR=fixtures/site-content`.
- The PR's Vercel preview renders every route with the sample banner.
- Screenshots at 375 px and 1280 px wide of `/`, `/board` and `/incidents` are attached to the PR.
  Use Playwright if it's available on Kobol; otherwise use the in-app browser, or skip with a note.

### Phase 3: Pipeline (dry run)

**Goal:** One command produces a valid, evidence-checked draft on Kobol without publishing.
**Depends on:** Phase 1. Phase 2 is needed only for the live check.

**Tasks**
1. `research/sources.yaml`, per §4.12. Verify with `npm run sources:check`.
2. `scripts/collect.ts` (§7.3), with tests against `fixtures/collect/`.
3. `scripts/build-context.ts` (§7.4).
4. `scripts/lib/*`: `run.ts` (child process with timeout and kill), `lock.ts`, `git.ts`,
   `keychain.ts`, `log.ts`, `transcript.ts` (§7.10).
5. `scripts/preflight.ts`, `scripts/daily.ts` and `scripts/daily.sh` (§7.2).
6. `scripts/publish.ts` and `scripts/promote.ts` (§7.6), tested against a temporary git repo with a
   bare remote.
7. `scripts/lib/summary.ts` (§7.7), with tests for the published, failed, skipped and dry-run formats.
8. `scripts/archive-urls.ts`, `scripts/score-forecasts.ts` and `scripts/agent-check.ts`.
9. `routine/agent-settings.json` (§8.5). Wire the template variables of `routine/PROMPT.md` and
   `REPAIR.md` (§10).
10. One-time setup (§8.9 steps 2–5), with JL doing the keychain step. Run the sandbox tests.
11. `docs/RUNBOOK.md`.

**Milestone**
- `npm run daily -- --dry-run --no-deadline` on Kobol finishes within 60 minutes and produces
  `drafts/<today>.json` that passes `npm run validate -- drafts/<today>.json --evidence logs/<today>.evidence.json`.
  Report the duration, attempts, repairs, sources and word count from `runs.jsonl`.
- `npm run daily -- --dry-run --simulate-failure` creates `needs-review/<today>/` and ends with a
  failure summary in the §7.7 format.

### Phase 4: Seed data

**Goal:** The incident database, strike log and state hold a researched baseline, so base rates and
scores mean something on day one.
**Depends on:** Phase 1, plus Phase 3's context builder for checking.

**Tasks**
1. Research and write incidents from 2022-02-24 to today, following the counting rules in
   `routine/STYLE.md` §4.
   - Mark them `seed: true`. Each needs at least 1 source; `date_precision: "month"` is allowed when
     only the month is known.
   - Aim for complete coverage of rung 3 and above and of every serious incident, and representative
     coverage of rungs 1–2.
   - Start from published compilations (government reports, think-tank trackers of Russian sabotage in
     Europe, press tallies of drone incursions), then fill gaps by search.
2. Strikes for the last 60 days, `seed: true`.
3. A researched `state.json`:
   - the ladder rung (computed)
   - pathway scores starting from the computed base rates
   - TIER1 country scores that respect their floors
   - every Appendix B indicator with its real status and evidence
   - assumptions A1–A5 (JL can edit them in review)
4. 8–12 starter forecasts with base rates, spread across horizons and pathways.
5. `docs/SEED-REPORT.md`:
   - counts by pathway, year and rung
   - the compilations and sources used
   - known gaps and judgement calls
   - the resulting rung, pathway scores and country scores, each with a one-line rationale

**Milestone**
- `npm run validate:all` passes.
- Every pathway has at least one incident.
- The preview's board and incidents pages render the seed (set Preview `ET_CONTENT_DIR=content` for
  this PR, or test locally).
- JL reviews `docs/SEED-REPORT.md` and approves it in the PR.

### Phase 5: Supervised runs and go-live

**Goal:** Three briefs JL has approved, then unattended daily publishing.
**Depends on:** Phases 1–4.

**Tasks**
1. Three supervised runs on three different days (JL stopped at two; see §0.5). For each:
   - `npm run daily -- --review` (at 05:30, or `--no-deadline` later)
   - JL reviews the `review/DATE` preview
   - `npm run promote -- --date DATE` once approved
   - Fix prompt, style or validator issues between runs, through PRs.
2. Create the scheduled task in the Claude app (§8.3), including the watched Run now with JL.
3. Watch the first unattended morning. Afterwards, write the go-live notes and set Status in
   `AGENTS.md`.

**Milestone**
- The first unattended brief is live before 06:55 Taipei.
- The task's run in the Claude app shows the "published" summary.
- `runs.jsonl` shows `published`.

---

## 10. Routine prompts

These files were written in Phase 0 and are part of this spec. Phase 3 wires them; only change
them through PRs.

| File | Role |
|---|---|
| `routine/STYLE.md` | Analytic standards: definitions, counting rules, scales, voice. Binding for the agent and the source of the methodology page's prose |
| `routine/TASK.md` | The scheduled task's prompt in the Claude app: run the pipeline, wait, reply with the summary. Not templated |
| `routine/PROMPT.md` | The research-and-draft prompt. `daily.ts` renders it and passes it to `claude -p` |
| `routine/REPAIR.md` | The repair prompt. Used with `--resume` and the validator's errors |

`daily.ts` replaces these template variables (`{{NAME}}`) before sending:

| Variable | Value |
|---|---|
| `{{DATE}}` | Run date, `YYYY-MM-DD` |
| `{{WINDOW_START}}`, `{{WINDOW_END}}` | From `windowFor(date)` |
| `{{WEEKLY}}` | `true` or `false` |
| `{{DEADLINE_LOCAL}}` | `HH:MM` Taipei time by which the draft must be written |
| `{{DRAFT_PATH}}` | `drafts/DATE.json` |
| `{{CONTEXT_PATH}}` | `drafts/context.json` |
| `{{PACK_MD_PATH}}` | `research/packs/DATE.md` |
| `{{SCHEMA_PATH}}` | `routine/schema/draft-brief.schema.json` |
| `{{STYLE_PATH}}` | `routine/STYLE.md` |
| `{{ERRORS_JSON}}` | REPAIR.md only: the validator's `errors` array, pretty-printed |

---

## Appendix A — Design tokens

The site uses ME Tracker's "paper" design (its design handoff, v3), so the two trackers read as
siblings. `app/globals.css` holds the tokens; this is a summary.

- **Colours:** paper `--bg #f3eee3`, deep `--bg-deep #eae2d0`, cards `--card #fbf8f0`; ink
  `--ink #14161a`, soft `#3b3e45`, mute `#6b6a62`; rules `--rule #14161a` and `--rule-soft #c9bfa8`;
  accent red `#b33a2e`, amber `#c48416`, green `#3e6b3a`; pill washes `--badge-esc #f1d9d5`,
  `--badge-mix #f3e3c6`, `--badge-ok #d9e3d3`, `--badge-neutral #ece6d8`. Light only; no dark mode.
- **Scales:** rungs 0–6 run grey, green, olive, amber, red, dark red, deep red (`--rung-N`); country
  scores 1–5 the same way (`--score-N`); probability terms are one red ramp, light to dark (`--p-*`).
- **Pathway colours in charts** (`--pw-*`): `#3d6fa8 #c0503a #22927a #c48416 #b4688f #4f7a34 #6b5aa8`,
  checked with the dataviz validator against the paper surface (adjacent CVD ΔE ≥ 8.9). Amber is below
  3:1 contrast, so every chart keeps a legend and a data table.
- **Type:** Newsreader for display and reading prose, IBM Plex Sans for text, IBM Plex Mono for labels
  and numbers, all through `next/font`. Kickers are 10 px mono, uppercase, tracked 0.14em; section labels
  11 px sans, 0.22em; the brief title is Newsreader 600 at up to 48 px.
- **Shapes:** no rounded corners anywhere. Sections open with a 1 px ink rule, a `§NN` number and an
  uppercase label. Pills are square, mono and uppercase, with a colour chip, and always carry their
  meaning as text.

## Appendix B — Starting indicators and assumptions

Indicators. Phase 1 marks them all `dormant`; Phase 4 sets the real statuses.

| id | tier | name |
|---|---|---|
| ind-airspace-tempo | incident | Airspace violations above the 90-day baseline |
| ind-border-tracks | incident | Russian drone and missile tracks near the Polish, Romanian and Moldovan borders |
| ind-gnss-baltic | incident | GPS interference over the Baltic and Finland |
| ind-sabotage-tempo | incident | Sabotage incidents and arrests above baseline |
| ind-undersea | incident | Undersea cable and pipeline incidents |
| ind-airport-closures | incident | Airport or port closures caused by drones |
| ind-redeployment | strategic | Russian units redeploying toward Finland, the Baltics, Kaliningrad or Belarus (description: units moving toward the Leningrad and Moscow military districts, Kaliningrad or Belarus; new formations near Finland and the Baltics) |
| ind-mobilisation | strategic | Mobilisation or large reserve call-ups |
| ind-exercises | strategic | Exercises larger than declared, or snap readiness checks near NATO borders |
| ind-stockpiling | strategic | Ammunition, fuel or medical stockpiling near NATO borders |
| ind-nuclear-posture | strategic | Nuclear readiness changes, or nuclear deployments to Belarus or Kaliningrad (description adds Oreshnik) |
| ind-pretext | strategic | Russian pretext narratives about the Baltics, Narva, Kaliningrad or Suwałki (description: "compatriots" in the Baltics, Narva, Kaliningrad transit, Suwałki) |
| ind-diplomatic | strategic | Diplomatic warning signs: embassy drawdowns, families leaving, airspace closures |
| ind-cyber-prepositioning | strategic | Public disclosures of cyber footholds in European grids, rail or telecoms |
| ind-us-posture | strategic | Changes in US force posture or commitment in Europe (amplifier) |
| ind-article4 | driver | A NATO Article 4 consultation requested |
| ind-article5 | driver | NATO Article 5 invoked |
| ind-longrange-weapons | driver | A US decision on Tomahawk-class long-range weapons for Ukraine |
| ind-ceasefire | driver | A ceasefire framework signed, or direct Putin–Zelensky talks |
| ind-refinery-offline | driver | Russian refinery capacity offline above 20% |
| ind-fuel-export-ban | driver | A Russian gasoline export ban or domestic fuel rationing |

Assumptions. These are a starting set; JL can edit them in the Phase 4 review.

| id | text |
|---|---|
| A1 | Russia avoids deliberate, attributable armed attacks on NATO territory while its main force is committed in Ukraine. |
| A2 | The United States remains committed to defending NATO allies under Article 5. |
| A3 | Most airspace incidents are spillover from strikes on Ukraine or deliberate probes below the threshold of attack, not preparation for an invasion. |
| A4 | Russia's covert campaign in Europe (sabotage, cables, jamming) continues regardless of battlefield or diplomatic developments. |
| A5 | A ceasefire in Ukraine would lower near-term incident risk but raise medium-term risk as Russian forces reconstitute near NATO borders. |

## Appendix C — Kobol environment facts (checked 2026-11-02)

- **Machine:** MacBook Pro, Apple silicon (arm64), macOS 26.7.1. User `kobol`, home `/Users/kobol`.
  About 759 GB free.
- **Node:**
  - `/opt/homebrew/bin/node` v26.13.0, arm64: **use this**, with npm 11.20 at `/opt/homebrew/bin/npm`.
  - `/usr/local/bin/node` v26.0.0, x86_64: **never use**.
- **Git:** `/usr/bin/git`. `gh` 2.103.3 at `/opt/homebrew/bin/gh`, logged in as 8gara8 (keyring;
  scopes include `repo` and `workflow`).
- **Claude CLI:** the existing `~/.local/bin/claude` → v2.1.78, x86_64 (Rosetta). Don't use it;
  install the native build (§8.4).
- **Vercel:** team "8gara8's projects" (`team_xxXFmwmVsAfTU86OFG8fcX3S`), Hobby plan. The `metracker`
  project lives there too. Don't modify it.
- **Power:** system sleep is disabled. An overnight OS update that restarts Kobol can leave it at the
  login window, and then the 05:30 run doesn't happen; JL would see no new run in the Claude app that
  morning. How Kobol handles updates is JL's call.
- **Other scheduled work on Kobol:**
  - MEtracker morning brief, daily at 07:30 (Claude desktop scheduled task; don't touch)
  - a nightly job at 03:00
  - the AYW product scan, Mondays around 06:30 (a different folder; only shared Claude usage)
- **Repo:** cloned at `/Users/kobol/Projects/EuropeTracker`, with repo-level git identity
  `8gara8 <62337733+8gara8@users.noreply.github.com>`.
