import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, windowFor } from "@/lib/dates";
import type { DraftBrief } from "@/lib/schema/draft-brief";
import { PATHWAYS, TIER1 } from "@/lib/vocab";
import { publish } from "@/scripts/publish";

// End to end: daily.ts against a temporary repo with a bare remote, a fake agent binary and an
// injected token, so nothing touches the real repo, the keychain or Claude.

const ROOT = path.resolve(__dirname, "..");
const FAKE = path.join(ROOT, "fixtures", "agent", "fake-claude.mjs");
const TSX = path.join(ROOT, "node_modules", ".bin", "tsx");
const DATE = "2026-11-04"; // a Wednesday
const MIN = 60_000;
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
  // The stand-in GitHub rejects pushes, or holds them for 30 s, while the matching marker file exists.
  fs.writeFileSync(path.join(remote, "hooks", "pre-receive"), [
    "#!/bin/sh",
    `[ -f ${shq(path.join(base, "reject-pushes"))} ] && { echo "rejected for the test" >&2; exit 1; }`,
    `[ -f ${shq(path.join(base, "slow-pushes"))} ] && sleep 30`,
    "exit 0",
  ].join("\n") + "\n", { mode: 0o755 });

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

/** How the stand-in GitHub treats pushes from now on. */
function pushes(mode: "accept" | "reject" | "slow") {
  for (const m of ["reject", "slow"]) fs.rmSync(path.join(base, `${m}-pushes`), { force: true });
  if (mode !== "accept") fs.writeFileSync(path.join(base, `${mode}-pushes`), "");
}

/** Points the fake agent at a valid draft for `date`. */
function agentWrites(date: string) {
  const file = writeJson(path.join(base, `good-${date}.json`), emptyWorldDraft(date));
  fakeAgent({ mode: "ok", draft: file, repair: file });
}

async function runDaily(args: string[], token: string | null = "test-token", date = DATE) {
  const cwd = process.cwd();
  process.chdir(work);
  try {
    // CI runners are x64; the arm64 check itself is covered in tests/pipeline.test.ts.
    const code = await daily.main(["--date", date, "--no-deadline", ...args], { readToken: () => token, arch: "arm64" });
    const summary = fs.readFileSync(path.join(work, "logs", `${date}.summary.md`), "utf8");
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

  it("pushes a brief whose push failed when the run is repeated, instead of skipping it", async () => {
    const date = "2026-11-05";
    agentWrites(date);
    pushes("reject");
    const failed = await runDaily([], "test-token", date);
    pushes("accept");
    expect(failed.code).toBe(1);
    expect(failed.summary).toContain("failed** (E_PUBLISH)");
    expect(sh(work, "log", "-1", "--format=%s")).toContain(`brief: ${date}`);
    expect(sh(remote, "log", "-1", "--format=%s", "main")).not.toContain(date);

    const rerun = await runDaily([], "test-token", date);
    expect(rerun.code).toBe(0);
    expect(rerun.summary).toContain(`**EuropeTracker ${date} — published**`);
    expect(rerun.last).toMatchObject({ outcome: "published", attempts: 0 });
    expect(sh(remote, "rev-parse", "main")).toBe(sh(work, "rev-parse", "HEAD"));
    expect((await runDaily([], "test-token", date)).last.outcome).toBe("skipped");
  }, 120_000);

  it("pushes a brief whose push failed with the documented recovery command", async () => {
    const date = "2026-11-06";
    agentWrites(date);
    pushes("reject");
    const failed = await runDaily([], "test-token", date);
    pushes("accept");
    expect(failed.summary).toContain(`npm run publish -- --date ${date}`);
    const out = execFileSync(TSX, [path.join(ROOT, "scripts", "publish.ts"), "--date", date], { cwd: work, encoding: "utf8" });
    expect(out).toContain(`Published ${date} on main`);
    expect(out).toContain("pushed after an earlier failure");
    expect(sh(remote, "rev-parse", "main")).toBe(sh(work, "rev-parse", "HEAD"));
    expect(sh(remote, "cat-file", "-t", `main:content/briefs/${date}.json`)).toBe("blob");
  }, 120_000);

  it("refuses to publish off main or over uncommitted content", async () => {
    const date = "2026-11-07";
    const before = sh(work, "rev-parse", "HEAD");
    sh(work, "checkout", "-q", "-b", "feature");
    try {
      await expect(publish({ repo: work, date, draft: emptyWorldDraft(date), evidence: null })).rejects.toThrow(/runs on main, but the repo is on feature/);
      expect(sh(work, "rev-parse", "HEAD")).toBe(before);
    } finally {
      sh(work, "checkout", "-q", "main");
      sh(work, "branch", "-q", "-D", "feature");
    }
    const stray = path.join(work, "content", "stray.json");
    fs.writeFileSync(stray, "{}\n");
    try {
      await expect(publish({ repo: work, date, draft: emptyWorldDraft(date), evidence: null })).rejects.toThrow(/content\/ has uncommitted changes/);
    } finally {
      fs.rmSync(stray);
    }
    expect(sh(work, "rev-parse", "HEAD")).toBe(before);
    expect(fs.existsSync(path.join(work, "content", "briefs", `${date}.json`))).toBe(false);
  }, 60_000);

  it("stops a slow push at the deadline and leaves the brief for the next push", async () => {
    const date = "2026-11-07";
    pushes("slow");
    const started = Date.now();
    try {
      await expect(publish({ repo: work, date, draft: emptyWorldDraft(date), evidence: null, deadline: started + 4_000 })).rejects.toThrow();
    } finally {
      pushes("accept");
    }
    expect(Date.now() - started).toBeLessThan(8_000);
    expect(sh(remote, "log", "-1", "--format=%s", "main")).not.toContain(date);
    const r = await publish({ repo: work, date, draft: null, evidence: null });
    expect(r).toMatchObject({ resumed: true, branch: "main" });
    expect(sh(remote, "rev-parse", "main")).toBe(r.commit);
  }, 60_000);

  it("keeps time for publishing when allotting repairs", () => {
    const stop = Date.parse(`${DATE}T06:55:00+08:00`);
    expect(daily.repairBudget(stop, stop - 20 * MIN)).toBe(6 * MIN);
    expect(daily.repairBudget(stop, stop - 7 * MIN)).toBe(3 * MIN); // ends 4 minutes before the stop
    expect(daily.repairBudget(stop, stop - 5 * MIN)).toBe(0);
  });

  it("stops waiting for the page at its limit", async () => {
    const server = http.createServer(() => { /* never answers */ });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const started = Date.now();
      const live = await daily.waitLive(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`, 1_500, { line: () => {} });
      expect(live).toBe(false);
      expect(Date.now() - started).toBeLessThan(4_000);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
