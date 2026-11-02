// The daily pipeline (SPEC §7.2): preflight → collect → context → agent (with repairs and one retry) →
// validate → publish → run summary. The script owns the lock, git and the failure path; the agent only
// researches and writes drafts/DATE.json.
//
//   tsx scripts/daily.ts [--date D] [--dry-run] [--review] [--force] [--no-deadline] [--simulate-failure] [--detach]

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadContent } from "../lib/content";
import { buildContext } from "../lib/context";
import { isValidDate, taipeiTime, taipeiToday, windowFor } from "../lib/dates";
import { Pack } from "../lib/schema/pack";
import type { AgentContext } from "../lib/schema/context";
import type { DraftBrief } from "../lib/schema/draft-brief";
import { siteUrl } from "../lib/site";
import { validateDraft, type ValidationIssue } from "../lib/validate";

type DraftResult = ReturnType<typeof validateDraft>;
import { totalWords } from "../lib/rules/words";
import { packInfo, writeContext } from "./build-context";
import { renderTemplate, runAgent, type AgentConfig } from "./lib/agent";
import { RunLog } from "./lib/log";
import { releaseLock } from "./lib/lock";
import { run } from "./lib/run";
import { renderSummary, type RunFacts, type SummaryInput } from "./lib/summary";
import { evidenceUrls, type Transcript } from "./lib/transcript";
import { preflight } from "./preflight";
import { publish, PublishError } from "./publish";

const env = process.env;
const MIN = 60_000;
/** The repo the code lives in. Runs normally use it as the working folder too; tests use a temporary one. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSX = path.join(ROOT, "node_modules", ".bin", "tsx");
export const CONFIG = {
  hardStop: env.ET_HARD_STOP ?? "06:55",
  retryCutoff: env.ET_RETRY_CUTOFF ?? "06:25",
  agentTimeoutMax: 45 * MIN,
  repairTimeout: 6 * MIN,
  maxRepairs: 2,
  /** Kept free after the last repair for publishing and the live check, so the run ends by the hard stop. */
  publishReserve: 4 * MIN,
  liveWaitMax: env.ET_LIVE_WAIT_MS ? Number(env.ET_LIVE_WAIT_MS) : 8 * MIN,
  archive: env.ET_ARCHIVE !== "0",
  collectTimeout: 4 * MIN,
  model: env.ET_MODEL ?? "opus",
  fallbackModel: env.ET_FALLBACK_MODEL ?? "sonnet",
  claudeBin: env.ET_CLAUDE_BIN ?? "/Users/kobol/.europetracker/cli/node_modules/.bin/claude",
  configDir: env.ET_CLAUDE_CONFIG_DIR ?? "/Users/kobol/.europetracker/claude",
  keepDays: 60,
};

type Outcome = "published" | "failed" | "skipped" | "dry_run";

class RunFailure extends Error {
  constructor(readonly code: string, message: string, readonly errors: ValidationIssue[] = []) {
    super(message);
  }
}

const NEXT_STEP: Record<string, string> = {
  E_ARCH: "run with the native Node: /opt/homebrew/bin/npx tsx scripts/daily.ts",
  E_NET: "Kobol had no network; rerun: npm run daily -- --no-deadline",
  E_GIT: "check `git status` in ~/Projects/EuropeTracker, then rerun: npm run daily -- --no-deadline",
  E_AUTH: "the Claude login token needs renewing (SPEC §8.6), then rerun: npm run daily -- --no-deadline",
  E_AGENT: "rerun: npm run daily -- --no-deadline",
  E_TIMEOUT: "rerun: npm run daily -- --no-deadline",
  E_VALIDATION: "fix the draft in needs-review, or rerun: npm run daily -- --no-deadline",
  E_PUBLISH: "the draft is valid: fix git, then run npm run publish -- --date DATE",
  E_SIMULATED: "nothing: this was a test of the failure path",
  E_INTERNAL: "read logs/DATE.daily.log, then rerun: npm run daily -- --no-deadline",
};

/** "06:55" on `date`, in Taipei, as epoch ms. */
const at = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+08:00`);

/** How long the next repair may run: up to REPAIR_TIMEOUT, ending PUBLISH_RESERVE before the hard stop; 0 when there's no room. */
export function repairBudget(hardStop: number, now: number): number {
  const left = hardStop - now - CONFIG.publishReserve;
  return left < 2 * MIN ? 0 : Math.min(CONFIG.repairTimeout, left);
}

function cleanup(repo: string, keepDays: number): void {
  const cutoff = Date.now() - keepDays * 86_400_000;
  for (const dir of ["logs", "drafts", "research/packs"]) {
    const full = path.join(repo, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      const p = path.join(full, f);
      const st = fs.statSync(p);
      if (st.isFile() && st.mtimeMs < cutoff && !f.startsWith(".")) fs.rmSync(p);
    }
  }
}

/** Polls `url` until it answers 200, never past `maxMs` from now. */
export async function waitLive(url: string, maxMs: number, log: Pick<RunLog, "line">): Promise<boolean> {
  const until = Date.now() + maxMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(Math.min(15_000, until - Date.now())) });
      if (res.status === 200) return true;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, Math.max(0, Math.min(20_000, until - Date.now()))));
  }
  log.line(`${url} was not live after ${Math.round(Math.max(0, maxMs) / 1000)} s.`);
  return false;
}

function detach(argv: string[], repo: string, date: string): number {
  const out = fs.openSync(path.join(repo, "logs", `${date}.detached.log`), "a");
  const child = spawn(TSX, [path.join(ROOT, "scripts", "daily.ts"), ...argv.filter((a) => a !== "--detach")], {
    cwd: repo, detached: true, stdio: ["ignore", out, out], env: process.env,
  });
  child.unref();
  console.log(`Started the daily run in the background (pid ${child.pid}); it ends with logs/${date}.summary.md.`);
  return 0;
}

export interface Deps {
  /** Reads the agent's token; the keychain by default (tests inject a fake). */
  readToken?: () => string | null;
  /** The CPU architecture preflight checks; process.arch by default (tests on x64 CI runners inject arm64). */
  arch?: string;
}

export async function main(argv = process.argv.slice(2), deps: Deps = {}): Promise<number> {
  const { values: f } = parseArgs({
    args: argv,
    options: {
      date: { type: "string" }, "dry-run": { type: "boolean" }, review: { type: "boolean" }, force: { type: "boolean" },
      "no-deadline": { type: "boolean" }, "simulate-failure": { type: "boolean" }, detach: { type: "boolean" },
    },
  });
  const repo = process.cwd();
  const date = f.date ?? taipeiToday();
  if (!isValidDate(date)) {
    console.error(`Invalid --date ${date}`);
    return 2;
  }
  fs.mkdirSync(path.join(repo, "logs"), { recursive: true });
  if (f.detach) return detach(argv, repo, date);

  const startedMs = Date.now();
  const started = new Date(startedMs).toISOString();
  const log = new RunLog(path.join(repo, "logs", `${date}.daily.log`));
  const hardStop = f["no-deadline"] ? startedMs + 75 * MIN : at(date, CONFIG.hardStop);
  const retryCutoff = f["no-deadline"] ? hardStop - 30 * MIN : at(date, CONFIG.retryCutoff);
  const lockFile = path.join(repo, "logs", ".lock");

  let outcome: Outcome = "failed";
  let errorCode: string | null = null;
  let attempts = 0;
  let repairs = 0;
  let summary: SummaryInput | null = null;
  let context: AgentContext | null = null;
  let lastResult: DraftResult | null = null;
  let words: number | null = null;
  let sources: number | null = null;
  const facts = (): RunFacts => ({ started, finished: new Date().toISOString(), attempts, repairs });
  const draftPath = path.join(repo, "drafts", `${date}.json`);

  /** 7. Publish (or push a brief an earlier run committed), then wait for the page, all before the hard stop. */
  const finish = async (draft: DraftBrief | null, evidence: string[] | null): Promise<SummaryInput> => {
    let published;
    try {
      published = await publish({ repo, date, draft, context: context ?? undefined, evidence, review: !!f.review, deadline: hardStop - 30_000, log: (m) => log.line(m) });
    } catch (e) {
      throw new RunFailure("E_PUBLISH", (e as Error).message, (e as PublishError).errors ?? []);
    }
    words = totalWords(published.brief);
    sources = published.brief.sources.length;
    const url = f.review ? null : `${siteUrl()}/brief/${date}`;
    const live = url ? await waitLive(url, Math.min(CONFIG.liveWaitMax, hardStop - Date.now() - 30_000), log) : false;
    if (!f.review && CONFIG.archive) {
      spawn(TSX, [path.join(ROOT, "scripts", "archive-urls.ts"), "--date", date], { cwd: repo, detached: true, stdio: "ignore" }).unref();
    }
    if (f.review) log.line(`Pushed ${published.branch}; Vercel builds its preview. Approve, then: npm run promote -- --date ${date}`);
    return { kind: "published", date, brief: published.brief, state: published.previous, liveUrl: live ? url : null, reviewBranch: f.review ? published.branch : undefined, words, facts: facts() };
  };

  log.line(`EuropeTracker daily run for ${date}${f["dry-run"] ? " (dry run)" : ""}${f.review ? " (review)" : ""}; hard stop ${taipeiTime(new Date(hardStop))}.`);
  try {
    // 1. Preflight.
    const pre = await preflight({ repo, date, force: !!f.force, dryRun: !!f["dry-run"], claudeBin: CONFIG.claudeBin, lockFile, readToken: deps.readToken, arch: deps.arch });
    if (pre.status === "skip") {
      log.line(pre.reason);
      outcome = "skipped";
      summary = { kind: "skipped", date, reason: pre.reason };
      return 0;
    }
    if (pre.status === "fail") throw new RunFailure(pre.code, pre.message);
    if (pre.status === "unpushed") {
      log.line(pre.reason);
      summary = await finish(null, null);
      outcome = "published";
      return 0;
    }
    for (const n of pre.notes) log.line(n);
    log.line("Preflight passed.");

    // 2. Collect.
    const collect = await run(TSX, [path.join(ROOT, "scripts", "collect.ts"), "--date", date], {
      cwd: repo, timeoutMs: CONFIG.collectTimeout, stdoutFile: path.join(repo, "logs", `${date}.collect.log`), stderrFile: path.join(repo, "logs", `${date}.collect.log`),
    });
    const pack = packInfo(repo, date);
    if (collect.code !== 0 || !fs.existsSync(path.join(repo, pack.json))) {
      log.line(`Collector failed (${collect.timedOut ? "timeout" : `exit ${collect.code}`}); continuing with an empty, degraded pack.`);
      fs.mkdirSync(path.join(repo, "research/packs"), { recursive: true });
      fs.writeFileSync(path.join(repo, pack.md), `# Source pack ${date}\n\nThe collector failed today (DEGRADED). There are no pack items: find everything with WebSearch and WebFetch.\n`);
      fs.writeFileSync(path.join(repo, pack.json), `${JSON.stringify(Pack.parse({ schema_version: 1, date, window: windowFor(date), generated_at: new Date().toISOString(), degraded: true, feeds: [], items: [] }), null, 2)}\n`);
    } else log.line(fs.readFileSync(path.join(repo, "logs", `${date}.collect.log`), "utf8").split("\n")[0] || "Collected the source pack.");
    const packUrls = (Pack.parse(JSON.parse(fs.readFileSync(path.join(repo, pack.json), "utf8")))).items.map((i) => i.url);

    // 3. Context. Kept in memory: the agent can write in drafts/, so the validator never trusts the file.
    const content = loadContent(path.join(repo, "content"), { fresh: true });
    const world = { incidents: content.incidents, strikes: content.strikes, forecasts: content.forecasts };
    const agentCfg: AgentConfig = { bin: CONFIG.claudeBin, configDir: CONFIG.configDir, model: CONFIG.model, fallbackModel: CONFIG.fallbackModel, repo, token: pre.token };
    const transcripts: Transcript[] = [];
    const evidenceFile = path.join(repo, "logs", `${date}.evidence.json`);
    const writeEvidence = () => {
      const urls = evidenceUrls(transcripts, packUrls);
      fs.writeFileSync(evidenceFile, `${JSON.stringify({ urls }, null, 2)}\n`);
      return urls;
    };
    const validate = (): DraftResult => {
      let draft: unknown;
      try {
        draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
      } catch (e) {
        const message = `drafts/${date}.json is not valid JSON (${(e as Error).message}); rewrite the whole file as valid JSON.`;
        return { ok: false, errors: [{ code: "SCHEMA", severity: "error", path: "(file)", message, hint: null }], warnings: [], draft: null };
      }
      return validateDraft(draft, { context: context!, world, evidence: writeEvidence(), fileDate: date });
    };
    const style = fs.readFileSync(path.join(repo, "routine/PROMPT.md"), "utf8");
    const repairTemplate = fs.readFileSync(path.join(repo, "routine/REPAIR.md"), "utf8");
    const vars = (deadline: number) => ({
      DATE: date, WINDOW_START: context!.window.start, WINDOW_END: context!.window.end, WEEKLY: String(context!.weekly),
      DEADLINE_LOCAL: taipeiTime(new Date(deadline)), DRAFT_PATH: `drafts/${date}.json`, CONTEXT_PATH: "drafts/context.json",
      PACK_MD_PATH: pack.md, SCHEMA_PATH: "routine/schema/draft-brief.schema.json", STYLE_PATH: "routine/STYLE.md",
    });

    // 4–6. Up to two attempts, each with up to two repairs.
    let ok = false;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      const now = Date.now();
      if (attempt === 2 && now > retryCutoff) {
        log.line(`No retry: it is past the retry cutoff (${taipeiTime(new Date(retryCutoff))}).`);
        break;
      }
      const timeout = Math.min(CONFIG.agentTimeoutMax, hardStop - now - 10 * MIN);
      if (timeout < 5 * MIN) {
        log.line("Not enough time left for an agent attempt.");
        if (attempt === 1) throw new RunFailure("E_TIMEOUT", "The run started too late to research a brief before the hard stop.");
        break;
      }
      attempts = attempt;
      fs.rmSync(draftPath, { force: true });
      context = buildContext(content, date, { deadline: new Date(now + timeout - 5 * MIN).toISOString(), pack });
      writeContext(repo, context);
      fs.writeFileSync(path.join(repo, "logs", `${date}.context.json`), `${JSON.stringify(context, null, 2)}\n`);
      const deadline = now + timeout - 5 * MIN;
      log.line(`Attempt ${attempt}: agent running (timeout ${Math.round(timeout / MIN)} min, write by ${taipeiTime(new Date(deadline))}).`);
      const transcriptFile = path.join(repo, "logs", `${date}.agent-${attempt}.jsonl`);
      const a = await runAgent(renderTemplate(style, vars(deadline)), agentCfg, { timeoutMs: timeout, transcriptFile });
      transcripts.push(a.transcript);
      log.line(`Attempt ${attempt}: agent ${a.run.timedOut ? "timed out" : `exited ${a.run.code}`} after ${Math.round(a.run.durationMs / MIN)} min · ${a.transcript.numTurns ?? "?"} turns · tools ${JSON.stringify(a.transcript.toolUses)}${a.transcript.isError ? " · reported an error" : ""}.`);
      if (a.transcript.authFailed) throw new RunFailure("E_AUTH", `The agent could not sign in: ${a.transcript.resultText ?? "authentication failed"}.`);
      if (!fs.existsSync(draftPath)) {
        log.line(`Attempt ${attempt}: no draft was written.`);
        errorCode = a.run.timedOut ? "E_TIMEOUT" : "E_AGENT";
        continue;
      }
      lastResult = validate();
      log.line(`Attempt ${attempt}: ${lastResult.errors.length} errors, ${lastResult.warnings.length} warnings.`);
      let attemptRepairs = 0;
      while (!lastResult.ok && attemptRepairs < CONFIG.maxRepairs && a.transcript.sessionId) {
        const budget = repairBudget(hardStop, Date.now());
        if (!budget) {
          log.line(`Attempt ${attempt}: no time for a repair before the hard stop.`);
          break;
        }
        attemptRepairs++;
        repairs++;
        const prompt = renderTemplate(repairTemplate, { ...vars(Date.now() + budget), ERRORS_JSON: JSON.stringify(lastResult.errors, null, 2) });
        log.line(`Attempt ${attempt}: repair ${attemptRepairs} for ${lastResult.errors.length} errors (${[...new Set(lastResult.errors.map((e) => e.code))].join(", ")}).`);
        const r = await runAgent(prompt, agentCfg, { timeoutMs: budget, transcriptFile: path.join(repo, "logs", `${date}.agent-${attempt}-repair-${attemptRepairs}.jsonl`), resume: a.transcript.sessionId });
        transcripts.push(r.transcript);
        lastResult = validate();
        log.line(`Attempt ${attempt}: after repair ${attemptRepairs}, ${lastResult.errors.length} errors.`);
      }
      ok = lastResult.ok;
      if (!ok) errorCode = "E_VALIDATION";
    }

    if (!ok) {
      throw new RunFailure(errorCode ?? "E_AGENT", errorCode === "E_VALIDATION"
        ? `The draft still had ${lastResult?.errors.length ?? "?"} validation errors after ${repairs} repairs and ${attempts} attempts.`
        : `The agent did not produce a draft in ${attempts} attempt${attempts === 1 ? "" : "s"}.`, lastResult?.errors ?? []);
    }
    const draft = lastResult!.draft!;
    words = totalWords(draft);
    sources = draft.sources.length;
    if (f["simulate-failure"]) {
      throw new RunFailure("E_SIMULATED", "A simulated validation failure, to test the failure path.", [{ code: "SIMULATED", severity: "error", path: "(run)", message: "--simulate-failure was set", hint: null }]);
    }

    // 7. Publish, unless this is a dry run.
    if (f["dry-run"]) {
      outcome = "dry_run";
      summary = { kind: "dry_run", date, brief: draft, state: content.state, liveUrl: null, words, draftPath: `drafts/${date}.json`, facts: facts() };
      log.line(`Dry run complete: drafts/${date}.json is valid.`);
      return 0;
    }
    summary = await finish(draft, JSON.parse(fs.readFileSync(evidenceFile, "utf8")).urls);
    outcome = "published";
    return 0;
  } catch (e) {
    const failure = e instanceof RunFailure ? e : new RunFailure("E_INTERNAL", (e as Error).stack ?? String(e));
    errorCode = failure.code;
    outcome = "failed";
    log.line(`FAILED ${failure.code}: ${failure.message}`);
    // 8. Failure path: keep everything needed to diagnose or finish by hand.
    const dir = path.join(repo, "needs-review", date);
    fs.mkdirSync(dir, { recursive: true });
    const copy = (from: string, to = path.basename(from)) => { if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dir, to)); };
    copy(draftPath);
    if (context) fs.writeFileSync(path.join(dir, "context.json"), `${JSON.stringify(context, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, "validator-report.json"), `${JSON.stringify({ code: failure.code, message: failure.message, errors: failure.errors, warnings: lastResult?.warnings ?? [] }, null, 2)}\n`);
    for (const file of fs.readdirSync(path.join(repo, "logs")).filter((x) => x.startsWith(`${date}.`))) copy(path.join(repo, "logs", file));
    copy(path.join(repo, "research", "packs", `${date}.md`), "pack.md");
    summary = {
      kind: "failed", date, code: failure.code, what: failure.message.split("\n")[0]!,
      errors: failure.errors.map((x) => ({ code: x.code, message: `${x.path}: ${x.message}` })),
      nextStep: (NEXT_STEP[failure.code] ?? NEXT_STEP.E_INTERNAL!).replace("DATE", date),
      facts: attempts ? facts() : null,
    };
    return 1;
  } finally {
    // 9. Always: the summary, the lock, the run record, old files.
    const text = summary ? renderSummary(summary) : `**EuropeTracker ${date} — failed** (E_INTERNAL)\n`;
    fs.writeFileSync(path.join(repo, "logs", `${date}.summary.md`), text);
    releaseLock(lockFile);
    const ended = new Date().toISOString();
    fs.appendFileSync(path.join(repo, "logs", "runs.jsonl"), `${JSON.stringify({
      date, started, ended, outcome, attempts, repairs, sources, words, error_code: errorCode, duration_s: Math.round((Date.now() - startedMs) / 1000),
    })}\n`);
    try { cleanup(repo, CONFIG.keepDays); } catch { /* best effort */ }
    log.line(`Run ended: ${outcome}.`);
    console.log(`\n${text}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(e); process.exitCode = 1; });
}
