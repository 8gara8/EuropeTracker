# EuropeTracker runbook

How the daily run works on Kobol, how to read what it leaves behind, and how to recover. Times are
Asia/Taipei. The spec is `SPEC.md` §7–§8; this file is the operator's view.

## The morning

| Time | What happens |
|---|---|
| 05:37 | The Claude app's scheduled task "Europe tracker morning" runs `zsh scripts/daily.sh` (prompt: `routine/TASK.md`). It's set for 05:30, and the app adds a fixed 7-minute delay to this task |
| 05:37–05:40 | Preflight, then the collector builds `research/packs/DATE.json` and `.md` |
| 05:40–06:10 | The headless agent researches and writes `drafts/DATE.json`; the validator checks it, and the agent repairs it up to twice |
| up to 06:25 | One fresh retry if the first attempt failed |
| 05:45–06:15 | Published: `content/briefs/DATE.json` committed and pushed; Vercel deploys in about a minute. The first unattended run, on 4 November, was live at 05:44 |
| after publishing | The source URLs go to the Wayback Machine in the background (`logs/DATE.archive.log`). Timeouts there are common and don't affect the brief |
| 06:55 | Hard stop. Whatever happened, the run ends with `logs/DATE.summary.md`, which the task posts in the Claude app |

There are no alerts (JL's decision). The summary in the Claude app is the update. If no summary appears
by 07:00, Kobol did not run the task (check that it is awake, logged in and the Claude app is open), or
the run is waiting on a prompt (below).

## The scheduled task

- **Where:** the Claude desktop app on Kobol, under **Scheduled**. That page hides tasks Claude set up
  from a project: click **Show** beside "N hidden tasks that Claude set up in Slack, a project or Claude
  Code". The Code tab's **Scheduled** page lists it too. It doesn't appear on the phone or the web.
- **Settings:** daily at 05:30 (cron `30 5 * * *`), folder `/Users/kobol/Projects/EuropeTracker`, the
  default permission mode, and one rule under **Always allowed**: Bash
  `zsh /Users/kobol/Projects/EuropeTracker/scripts/daily.sh`.
- **A run:** the task starts that command in the background and ends its turn. The app wakes it when
  the pipeline exits; it reads `logs/DATE.summary.md` and replies with it. Each run is listed under
  **History** on the task page.
- **A run waiting on a permission prompt blocks the next morning:** the app skips a scheduled run
  while the previous one is still in progress. If a run is stuck, open it from History, then answer
  the prompt or stop the run. Keep the command in `routine/TASK.md` exactly as approved.
- **Changing the prompt:** merge the change to `routine/TASK.md`, then paste it into the task's Edit
  form (pencil icon) or into `~/.claude/scheduled-tasks/europe-tracker-morning/SKILL.md`, below the
  front matter.
- **Run now** on the task page runs the morning job at once. If today's brief is already published,
  it skips and says so.
- **Needs** the Claude app open and Kobol awake. If Kobol slept through 05:37, the app starts one
  catch-up run when it wakes. Too close to 06:55, that run ends with `E_TIMEOUT`; rerun it by hand
  (below).

## What each file tells you

| File | What it is |
|---|---|
| `logs/DATE.summary.md` | The run summary JL sees. Published, failed (with the error code and the next step), skipped or dry run |
| `logs/DATE.daily.log` | Step-by-step log of the run, one timestamped line per step |
| `logs/runs.jsonl` | One line per run: outcome, attempts, repairs, sources, words, error code, duration |
| `logs/DATE.collect.log` | Collector output: item count, failed feeds |
| `logs/DATE.context.json` | The exact context the validator used (the copy in `drafts/` could have been edited by the agent) |
| `logs/DATE.agent-N.jsonl` | The agent's stream-json transcript for attempt N; `…-repair-K.jsonl` for repairs; `.stderr` beside each |
| `logs/DATE.evidence.json` | Every URL the agent could cite: pack items, fetched pages and search results |
| `logs/DATE.archive.log` | The Wayback Machine requests made after publishing. Timeouts are common and harmless |
| `logs/archive-index.pending.json` | Wayback snapshots requested after publishing, merged by the next publish |
| `drafts/DATE.json`, `drafts/context.json` | The agent's draft and its context |
| `research/packs/DATE.md` | The source pack the agent read |
| `needs-review/DATE/` | After a failure: the draft, context, validator report, logs and pack. Kept until you delete it |

`logs/`, `drafts/` and `research/packs/` keep 60 days. Read a transcript's tool calls quickly with
`grep -o '"name":"[A-Za-z]*"' logs/DATE.agent-1.jsonl | sort | uniq -c`.

## Error codes

| Code | Meaning | What to do |
|---|---|---|
| `E_ARCH` | Not running on the native arm64 Node | Run through `scripts/daily.sh`, which uses `/opt/homebrew/bin` |
| `E_NET` | github.com didn't answer within 10 s | Check Kobol's network, then rerun |
| `E_GIT` | Uncommitted changes, an unreachable remote, local commits on main that aren't briefs, or briefs that conflict with GitHub's main | `git status` and `git log origin/main..main` in the repo; commit, stash or discard, then rerun |
| `E_AUTH` | The Claude CLI is missing, the keychain token is missing, or the agent couldn't sign in | Renew the token (below), then `npm run agent:check` |
| `E_AGENT` | The agent finished without writing a draft, twice | Read the transcripts; rerun |
| `E_TIMEOUT` | No time left for an attempt (the run started late) | Rerun with `--no-deadline` |
| `E_VALIDATION` | The draft still had errors after repairs and the retry | See `needs-review/DATE/validator-report.json`; fix the draft and publish it by hand, or rerun |
| `E_PUBLISH` | The draft was valid but committing or pushing failed | Fix git, then `npm run publish -- --date DATE`, or rerun the daily run: either pushes a brief that's committed but not on GitHub |
| `E_SIMULATED` | A test of the failure path (`--simulate-failure`) | Nothing |
| `E_INTERNAL` | A bug | Read the stack trace at the end of `logs/DATE.daily.log` |

## Manual runs

All from `~/Projects/EuropeTracker`, with the native tools on the PATH (`export PATH=/opt/homebrew/bin:$PATH`).

| Job | Command |
|---|---|
| Rerun from the Claude app | **Run now** on the task page (skips if today's brief exists) |
| Rerun this morning's brief | `npm run daily -- --no-deadline` (the deadline becomes start + 75 minutes) |
| Rerun even though today's brief exists | `npm run daily -- --no-deadline --force` (publish still refuses to overwrite; delete the brief by PR first) |
| Dry run (no git writes, no publish) | `npm run daily -- --dry-run --no-deadline` |
| Supervised run | `npm run daily -- --review --no-deadline`, check the `review/DATE` preview, then `npm run promote -- --date DATE` |
| Test the failure path | `npm run daily -- --dry-run --no-deadline --simulate-failure` |
| Publish a draft you fixed by hand | `npm run validate -- drafts/DATE.json --evidence logs/DATE.evidence.json`, then `npm run publish -- --date DATE` |
| Check every feed | `npm run sources:check` |
| Build only the pack, or only the context | `npm run collect -- --date DATE`, `npm run context -- --date DATE` |
| Forecast scores | `npm run forecasts:report` |

To finish a failed morning by hand: copy `needs-review/DATE/DATE.json` to `drafts/DATE.json`, fix the
errors listed in `validator-report.json`, validate, then publish.

## The Claude CLI and its token

- The agent uses a native arm64 Claude Code CLI installed on its own, at
  `/Users/kobol/.europetracker/cli/node_modules/.bin/claude`, with the config folder
  `/Users/kobol/.europetracker/claude`. It is deliberately not on the PATH, so JL's own `claude` is
  unaffected.
- **Check it:** `npm run agent:check` (one turn) or `npm run agent:check -- --sandbox` (also the four
  sandbox tests).
- **Renew the token** (when a run fails with `E_AUTH`, or before it expires), in Terminal on Kobol:

  ```
  CLAUDE_CONFIG_DIR=$HOME/.europetracker/claude $HOME/.europetracker/cli/node_modules/.bin/claude setup-token
  security add-generic-password -U -a kobol -s europetracker-claude-oauth -w
  ```

  The first command signs in through the browser and prints a token; the second stores it, asking for
  it twice. Never paste the token anywhere else.
- The current token was created on 2 November 2026 and lasts a year: renew it before 2 November 2027.
  On Kobol, `~/.europetracker/save-token.zsh` (outside the repo) runs both steps and saves the token
  only after a test call with it works.
- **Update the CLI:** `/opt/homebrew/bin/npm install --prefix $HOME/.europetracker/cli @anthropic-ai/claude-code@<version>`,
  then `npm run agent:check -- --sandbox`. Check `claude --help` for changed flags first (SPEC §8.4).

## Things not to do

- Don't touch MEtracker (`~/Documents/MEwar`), its scheduled tasks or its Vercel project.
- Don't push code to `main` directly; code goes through pull requests. Only the pipeline pushes
  `content/`.
- Don't widen the agent's tools or settings (`scripts/lib/agent.ts`, `routine/agent-settings.json`).
- Don't leave uncommitted changes in the repo overnight: the 05:30 run refuses a dirty tree (`E_GIT`).
- Don't move the repo into `~/Documents` or `~/Desktop`: iCloud Drive syncs those folders and makes
  conflict copies ("state 2.json") of files the pipeline rewrites, which stops the next run (`E_GIT`).
