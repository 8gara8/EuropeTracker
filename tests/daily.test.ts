import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, windowFor } from "@/lib/dates";
import type { DraftBrief } from "@/lib/schema/draft-brief";
import { PATHWAYS, TIER1 } from "@/lib/vocab";

// End to end: daily.ts against a temporary repo with a bare remote, a fake agent binary and an
// injected token, so nothing touches the real repo, the keychain or Claude.

const ROOT = path.resolve(__dirname, "..");
const FAKE = path.join(ROOT, "fixtures", "agent", "fake-claude.mjs");
const DATE = "2026-11-04"; // a Wednesday
let base: string;
let work: string;
let remote: string;
let daily: typeof import("@/scripts/daily");

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** The quiet-day fixture, reworked to be valid against the empty placeholder content. */
function emptyWorldDraft(date: string): DraftBrief {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/briefs/valid-quiet.json"), "utf8")) as DraftBrief;
  const remote5 = { probability: 5, term: "remote" as const, confidence: "low" as const };
  return {
    ...d,
    date,
    window: windowFor(date),
    weekly: false,
    weekly_outlook: null,
    board: {
      ladder: { current_rung: 0, previous_rung: 0, next_rung_odds: remote5, rationale: "No incident in the last 30 days." },
      pathways: PATHWAYS.map((pathway) => ({ pathway, serious_odds: remote5, impact: 1 as const, trend: "flat" as const, rationale: "No change.", source_ids: [] })),
      countries: TIER1.map((country) => ({ country, score: 1 as const, previous_score: 1 as const, reason: null, source_ids: [], indicator_ids: [], cohesion_flag: false })),
    },
    next_72h: [{ date: addDays(date, 1), event: "SAMPLE: EU ambassadors meet on sanctions.", why: "SAMPLE: shows whether the package moves." }],
  };
}

function fakeAgent(cfg: { mode: "ok" | "nodraft" | "auth"; draft?: string; repair?: string }) {
  const file = path.join(base, "claude", "fake-agent.json");
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  fs.writeFileSync(file, JSON.stringify({ ...prev, ...cfg }));
}

function writeJson(file: string, value: unknown) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

beforeAll(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "et-daily-"));
  remote = path.join(base, "remote.git");
  work = path.join(base, "work");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
  fs.mkdirSync(work);
  sh(work, "init", "-q", "-b", "main");
  sh(work, "config", "user.name", "test");
  sh(work, "config", "user.email", "test@example.org");
  fs.cpSync(path.join(ROOT, "content"), path.join(work, "content"), { recursive: true });
  fs.cpSync(path.join(ROOT, "routine"), path.join(work, "routine"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, ".gitignore"), path.join(work, ".gitignore"));
  fs.mkdirSync(path.join(work, "research"));
  fs.writeFileSync(path.join(work, "research/sources.yaml"), "schema_version: 1\ndomains: {}\nkeywords: []\nfeeds: []\n");
  sh(work, "add", "-A");
  sh(work, "commit", "-q", "-m", "init");
  sh(work, "remote", "add", "origin", remote);
  sh(work, "push", "-q", "-u", "origin", "main");

  const good = emptyWorldDraft(DATE);
  const bad = { ...good, board: { ...good.board, pathways: good.board.pathways.map((p, i) => (i === 0 ? { ...p, trend: "up" as const } : p)) } };
  // The agent's PATH has no Node outside Homebrew (scripts/lib/agent.ts), so CI runners can't resolve
  // the stand-in's shebang; a wrapper starts it with the Node running these tests.
  const bin = path.join(base, "fake-claude");
  fs.writeFileSync(bin, `#!/bin/sh\nexec ${shq(process.execPath)} ${shq(FAKE)} "$@"\n`, { mode: 0o755 });
  process.env.ET_CLAUDE_BIN = bin;
  process.env.ET_CLAUDE_CONFIG_DIR = path.join(base, "claude");
  process.env.ET_LIVE_WAIT_MS = "0";
  process.env.ET_ARCHIVE = "0";
  fs.mkdirSync(path.join(base, "claude"));
  fakeAgent({ mode: "ok", draft: writeJson(path.join(base, "bad.json"), bad), repair: writeJson(path.join(base, "good.json"), good) });
  daily = await import("@/scripts/daily");
}, 60_000);

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

async function runDaily(args: string[], token: string | null = "test-token") {
  const cwd = process.cwd();
  process.chdir(work);
  try {
    // CI runners are x64; the arm64 check itself is covered in tests/pipeline.test.ts.
    const code = await daily.main(["--date", DATE, "--no-deadline", ...args], { readToken: () => token, arch: "arm64" });
    const summary = fs.readFileSync(path.join(work, "logs", `${DATE}.summary.md`), "utf8");
    const runs = fs.readFileSync(path.join(work, "logs", "runs.jsonl"), "utf8").trim().split("\n");
    return { code, summary, last: JSON.parse(runs.at(-1)!) };
  } finally {
    process.chdir(cwd);
  }
}

describe("daily.ts", () => {
  it("fails cleanly without a token", async () => {
    const r = await runDaily(["--dry-run"], null);
    expect(r.code).toBe(1);
    expect(r.summary).toContain("failed** (E_AUTH)");
    expect(r.last).toMatchObject({ outcome: "failed", error_code: "E_AUTH" });
    expect(fs.existsSync(path.join(work, "logs", ".lock"))).toBe(false);
  }, 60_000);

  it("reports a sign-in failure from the agent's transcript", async () => {
    fakeAgent({ mode: "auth" });
    const r = await runDaily(["--dry-run"]);
    fakeAgent({ mode: "ok" });
    expect(r.code).toBe(1);
    expect(r.summary).toContain("failed** (E_AUTH)");
    expect(r.summary).toContain("token needs renewing");
  }, 60_000);

  it("retries once when the agent writes no draft, then fails", async () => {
    fakeAgent({ mode: "nodraft" });
    const r = await runDaily(["--dry-run"]);
    fakeAgent({ mode: "ok" });
    expect(r.code).toBe(1);
    expect(r.last).toMatchObject({ outcome: "failed", error_code: "E_AGENT", attempts: 2 });
  }, 60_000);

  it("takes the failure path on --simulate-failure, after repairing the draft", async () => {
    const r = await runDaily(["--dry-run", "--simulate-failure"]);
    expect(r.code).toBe(1);
    expect(r.summary).toContain("failed** (E_SIMULATED)");
    expect(r.last).toMatchObject({ outcome: "failed", error_code: "E_SIMULATED", attempts: 1, repairs: 1 });
    const dir = path.join(work, "needs-review", DATE);
    expect(fs.existsSync(path.join(dir, `${DATE}.json`))).toBe(true);
    expect(fs.existsSync(path.join(dir, "validator-report.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "context.json"))).toBe(true);
  }, 60_000);

  it("produces a valid draft on a dry run without touching git", async () => {
    const head = sh(work, "rev-parse", "HEAD");
    const r = await runDaily(["--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.summary).toContain(`**EuropeTracker ${DATE} — dry run**`);
    expect(r.last).toMatchObject({ outcome: "dry_run", repairs: 1 });
    expect(sh(work, "rev-parse", "HEAD")).toBe(head);
    const evidence = JSON.parse(fs.readFileSync(path.join(work, "logs", `${DATE}.evidence.json`), "utf8"));
    expect(evidence.urls.length).toBeGreaterThan(3);
  }, 60_000);

  it("publishes to main and pushes, then skips a second run", async () => {
    const r = await runDaily([]);
    expect(r.code).toBe(0);
    expect(r.summary).toContain("— published**");
    expect(r.summary).toContain("committed, not yet live");
    expect(fs.existsSync(path.join(work, "content", "briefs", `${DATE}.json`))).toBe(true);
    expect(sh(remote, "log", "-1", "--format=%s", "main")).toBe(`brief: ${DATE} — SAMPLE — Quiet night; EU sanctions talks resume`);
    const state = JSON.parse(fs.readFileSync(path.join(work, "content", "state.json"), "utf8"));
    expect(state.as_of).toBe(DATE);

    const again = await runDaily([]);
    expect(again.code).toBe(0);
    expect(again.summary).toContain("skipped");
    expect(again.last.outcome).toBe("skipped");
  }, 90_000);
});
