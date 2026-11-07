# EuropeTracker — agent guide (read this first)
> Internal AI working notes in a public repo: keep secrets, personal data and machine security details out. Never publish this file on the site.
> Last reviewed 2026-11-04 · Folder: /Users/kobol/Projects/EuropeTracker (Kobol) · Claude Project: Ukraine Tracker
> About JL and other projects: /Users/8gara8/Documents/AGENTS.md, on JL's other Mac. It isn't reachable from Kobol; if you need it, ask JL rather than guess.

## 1. Who and what

EuropeTracker is a daily morning brief. It answers one question: how likely is the Russia-Ukraine war
to spill into Europe, through which routes, where, and what changed in the last 24 hours? The war is
tracked only as the drivers of that risk.

- **Owner and main reader:** JL (GitHub `8gara8`), who reads it on a phone before
  08:00 Taipei.
- **Sibling project:** MEtracker, a Middle East war brief, at `/Users/kobol/Documents/MEwar`.
- **Good output:**
  - live by about 06:15 Taipei, never later than 06:55
  - the bottom line and spillover board readable in two minutes
  - every claim attributed and sourced, and every score anchored to base rates
  - honest about uncertainty, with no padding

## 2. Start of every session

1. Read this file.
2. Read `SPEC.md` §0, then the section for the phase or area you're working on.
3. Run `git status`, `git log --oneline -5` and `gh pr list`, so you know what's in flight.
4. Before touching content, prompts or validation, read `routine/STYLE.md`.
5. When debugging the daily pipeline, read the tail of `logs/runs.jsonl`, that day's
   `logs/DATE.daily.log`, and anything in `needs-review/`.

## 3. Status, decisions and dates

- **2026-11-02:** design v0.2 approved by JL (`docs/DESIGN.md`). `SPEC.md` v1.0, the agent prompts and
  `STYLE.md` were written and committed (Phase 0).
- **2026-11-02:** Phase 1 built: Zod schemas, the validator with every §4.11 rule, placeholder
  `content/`, fixtures (3 valid, 54 invalid), 108 tests, and CI. Spec refinements are in `SPEC.md` §0.5.
- **2026-11-02:** Phase 2 built: every page in §5, the SAMPLE dataset in `fixtures/site-content`, and
  the Vercel project `europetracker` (previews show the sample with a banner). No production deploy yet.
- **2026-11-02:** Phase 3 code built: 79 verified feeds, the collector, `daily.ts` with retries,
  repairs and the failure path, publish and promote, the run summary, and `docs/RUNBOOK.md`. The native
  Claude CLI is installed in `~/.europetracker/cli`. The real dry run waits for JL's agent token.
- **2026-11-02:** Phase 4 seed built for JL's review: 248 incidents (February 2022 to 2 November 2026),
  47 strikes from the last 60 days, the starting state (rung 4) and 11 forecasts, written as YAML in
  `research/seed/` and built with `npm run seed:build`. Gaps and judgement calls: `docs/SEED-REPORT.md`.
- **2026-11-02:** Phase 3's real dry run passed once JL had created the agent token (11 minutes, one
  repair). JL merged the seed (PR #5).
- **2026-11-02 to 11-04:** Phase 5. The site took ME Tracker's paper design and went further (PR #7).
  JL approved supervised briefs on 2 and 3 November, then chose to go unattended instead of running a
  third. The scheduled task "Europe tracker morning" was set up on 3 November. On 4 November the first
  unattended brief started at 05:37 and was live at 05:44. **EuropeTracker is live.**
- **Decisions, 2026-11-02:**
  - **Goal:** gauge spillover risk to Europe. Ukraine's deep strikes into Russia are emphasised as a
    driver.
  - **Schedule:** no day count; one morning brief that starts at 05:30 Taipei, ahead of MEtracker's
    07:30 run.
  - **No alerts.** JL gets updates from the Claude interface. The daily run is a scheduled task in the
    Claude app on Kobol (like MEtracker), and its reply, the run summary, is the update. No email,
    Telegram, GitHub-issue or watchdog alerts.
  - **Content:** every brief has an "Impact on Taiwan" section on how developments might affect
    Taiwan (JL, 2026-11-02; see `routine/STYLE.md` §14).
  - **Repo:** public (JL, 2026-11-02).
  - **Left to JL:** whether to move MEtracker's run to 07:00, and how Kobol handles overnight OS
    updates.
  - **Coding:** happens in a separate thread on Opus 5.5 (Ultracode), working from `SPEC.md`.
- **Phases:**

| Phase | Status |
|---|---|
| 0. Design, spec, prompts | Done 2026-11-02 |
| 1. Contract (schemas, validator, fixtures, tests) | Done 2026-11-02 |
| 2. Site and Vercel project | Done 2026-11-02; redesigned in Phase 5 |
| 3. Pipeline, dry run | Done 2026-11-02 |
| 4. Seed data | Done 2026-11-02 |
| 5. Supervised runs, go-live | Done 2026-11-04: unattended every morning since then |

- **Main deliverable:** the daily brief at https://europetracker.vercel.app, live since 2 November 2026.

## 4. Map

- `SPEC.md`: the build spec, and the start-here file for any build work.
- `docs/DESIGN.md`: the approved design, the "why". Frozen; change it only through a PR.
- `routine/STYLE.md`, `routine/PROMPT.md`, `routine/REPAIR.md`: the research agent's standards and
  prompts. `routine/TASK.md` is the prompt of the scheduled task in the Claude app.
- `content/`: published data (briefs, incidents, strikes, state, forecasts). Only the pipeline pushes
  here directly.
- `research/sources.yaml`: the source registry. Packs in `research/packs/` are gitignored.
- `lib/`: vocabularies, Zod schemas, aggregates, the validator and its rules (`lib/rules/`).
- `app/`, `components/`: the static Next.js site. `scripts/`: the pipeline, once Phase 3 builds it.
- `fixtures/`: validator fixtures, generated by `fixtures/src/` (`npm run fixtures:gen`). `tests/`: Vitest.
- `drafts/`, `logs/`, `needs-review/`: local runtime folders, gitignored.

## 5. Rules

- **Never touch MEtracker** (`~/Documents/MEwar`), its scheduled tasks, its Vercel project
  `metracker`, or any other project on Kobol.
- **Native arm64 tools only.** Use `/opt/homebrew/bin/node` and `/opt/homebrew/bin/npm`. Never
  `/usr/local/bin/node` (Intel). Use the native Claude CLI from `SPEC.md` §8.4, never
  `~/.local/bin/claude` (Intel).
- **No credentials in chat, code, logs or commits.** JL creates the keychain items; code reads them at
  run time.
- **The repo is public.** Never commit secrets, tokens, personal data, or details of Kobol's security
  settings. Create no other public surface without JL's say-so.
- **The research agent is sandboxed** (`SPEC.md` §8.5). Don't widen its tools.
- **Change control:** code changes go through pull requests; the pipeline pushes content only.
- **The spec governs.** If you diverge from `SPEC.md`, update it in the same PR and add a row to §0.5.
- **Times are Asia/Taipei** unless labelled. Write in English, in plain prose.
- **Traps:**
  - "Rung" is the spillover ladder level; "score" is a country's 1–5 exposure.
  - Strike verification has 5 levels and incident attribution has 4. Don't mix them up.

## 6. Workflows

| Job | How |
|---|---|
| Daily brief | The scheduled task "Europe tracker morning" in the Claude app (05:30, starting at 05:37 after the app's fixed delay; prompt `routine/TASK.md`) runs `scripts/daily.sh`, which runs `scripts/daily.ts`, then replies with `logs/DATE.summary.md`. Finding and changing the task: `docs/RUNBOOK.md` |
| Manual or test run | `npm run daily -- --dry-run --no-deadline`; supervised: `npm run daily -- --review`, then `npm run promote -- --date D` |
| Validate | `npm run validate -- drafts/D.json` or `npm run validate:all` |
| Check feeds | `npm run sources:check` |
| Change a schema or rule | Update `lib/schema` or `lib/rules`, then `npm run fixtures:gen` (it fails if a fixture stops validating as intended), the tests, and `npm run schema:gen`; bump `schema_version` if the content shape changes |
| Checks before a PR | `npm run typecheck && npm test && npm run validate:all && npm run schema:check && npm run build` |
| Preview the site | `npm run dev:sample` (sample data) or `npm run dev`; Vercel builds a preview of every pushed branch with the sample data |
| Debug or recover a run | `docs/RUNBOOK.md`: files, error codes, manual runs, renewing the token |
| Run results | No alerts by design. Every run ends with `logs/DATE.summary.md`, which the scheduled task posts in the Claude app; failed drafts go to `needs-review/DATE/` |

## 7. Memory

- No `_memory/` folder exists for this repo yet. Project context lives in the claude.ai project
  "Ukraine Tracker" and in `docs/`.
- Design v0.1 (a Claude Doc) is superseded by v0.2, which is `docs/DESIGN.md`.
- The MEtracker lessons that shaped this design are in `SPEC.md` §0.4.

## 8. Keeping this guide current

- After a working session, update §3 (status and phase table) and the "Last reviewed" date.
- Read the whole guide before changing it.
- If you restructure it, keep the previous version in git history and say why in the commit message.
