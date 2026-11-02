import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyDraft } from "@/lib/apply";
import { AgentContext } from "@/lib/schema/context";
import type { DraftBrief } from "@/lib/schema/draft-brief";
import type { Incident } from "@/lib/schema/incident";
import { agentArgs, agentEnv, renderTemplate } from "@/scripts/lib/agent";
import { acquireLock, releaseLock } from "@/scripts/lib/lock";
import { run } from "@/scripts/lib/run";
import { changes, renderSummary } from "@/scripts/lib/summary";
import { evidenceUrls, parseTranscript } from "@/scripts/lib/transcript";
import { serialize, taipeiTimestamp } from "@/scripts/publish";
import { promote } from "@/scripts/promote";
import { preflight } from "@/scripts/preflight";

const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const tmp: string[] = [];
const mkdtemp = (prefix: string) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmp.push(d);
  return d;
};
afterEach(() => { for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe("preflight", () => {
  it("refuses a non-native (x64) Node before any other check", async () => {
    const r = await preflight({ repo: "/nonexistent", date: "2026-11-04", force: false, dryRun: true, claudeBin: "/nonexistent", lockFile: "/nonexistent/lock", arch: "x64" });
    expect(r).toMatchObject({ status: "fail", code: "E_ARCH" });
  });
});

describe("lock", () => {
  it("is exclusive while the holder lives, and replaced when stale", () => {
    const file = path.join(mkdtemp("et-lock-"), ".lock");
    expect(acquireLock(file)).toEqual({ acquired: true, replacedStale: null });
    expect(acquireLock(file).acquired).toBe(false); // this process still holds it
    releaseLock(file);
    expect(fs.existsSync(file)).toBe(false);
    fs.writeFileSync(file, JSON.stringify({ pid: 999_999, started: new Date().toISOString() }));
    const r = acquireLock(file);
    expect(r.acquired && r.replacedStale).toContain("pid 999999");
    releaseLock(file);
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid, started: "2020-01-01T00:00:00Z" }));
    expect(acquireLock(file).acquired).toBe(true); // older than two hours
    releaseLock(file);
  });
});

describe("run", () => {
  it("kills a child that outlives its timeout", async () => {
    const r = await run("/bin/sh", ["-c", "sleep 5"], { timeoutMs: 300, killGraceMs: 200 });
    expect(r.timedOut).toBe(true);
    expect(r.durationMs).toBeLessThan(3000);
  });
  it("returns the exit code and output", async () => {
    const r = await run("/bin/sh", ["-c", "echo hi; exit 3"], { timeoutMs: 5000 });
    expect(r).toMatchObject({ code: 3, timedOut: false, stdout: "hi\n" });
  });
});

describe("transcript", () => {
  it("reads a real sign-in failure from Claude Code 2.1.316", () => {
    const t = parseTranscript(fs.readFileSync("fixtures/agent/transcript-auth-failed.jsonl", "utf8"));
    expect(t).toMatchObject({ version: "2.1.316", model: "claude-opus-5-5", authFailed: true, isError: true, numTurns: 1 });
    expect(t.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("collects fetched URLs and URLs in tool results into the evidence set", () => {
    const lines = [
      { type: "system", subtype: "init", session_id: "s1", model: "m", claude_code_version: "x" },
      { type: "assistant", message: { content: [{ type: "tool_use", name: "WebFetch", input: { url: "https://www.example.org/a?utm_source=x" } }, { type: "tool_use", name: "WebSearch", input: { query: "drones" } }] } },
      { type: "user", message: { content: [{ type: "tool_result", content: [{ type: "text", text: "Links: https://b.example/x, https://c.example/y." }] }] } },
      { type: "result", subtype: "success", is_error: false, result: "DONE", num_turns: 4, total_cost_usd: 0.5, permission_denials: [{}] },
    ].map((l) => JSON.stringify(l)).join("\n");
    const t = parseTranscript(`${lines}\nnot json\n`);
    expect(t).toMatchObject({ sessionId: "s1", searches: ["drones"], toolUses: { WebFetch: 1, WebSearch: 1 }, isError: false, numTurns: 4, permissionDenials: 1 });
    expect(evidenceUrls([t], ["https://t.me/s/kpszsu/1"])).toEqual(["https://b.example/x", "https://c.example/y", "https://example.org/a", "https://t.me/kpszsu/1"]);
  });
});

describe("agent invocation", () => {
  it("passes the sandbox flags and a minimal environment", () => {
    const args = agentArgs("PROMPT", { model: "opus", fallbackModel: "sonnet" }, "sess");
    expect(args.slice(0, 4)).toEqual(["-p", "PROMPT", "--resume", "sess"]);
    for (const flag of ["--restricted", "--safe-mode", "--strict-mcp-config", "--permission-mode"]) expect(args).toContain(flag);
    expect(args[args.indexOf("--tools") + 1]).toBe("WebSearch,WebFetch,Read,Glob,Grep,Write,Edit");
    expect(args.at(-3)).toBe("Bash"); // the variadic deny list ends the command line
    expect(Object.keys(agentEnv({ configDir: "/c", token: "t" })).sort()).toEqual(["CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CONFIG_DIR", "DISABLE_AUTOUPDATER", "HOME", "LANG", "PATH", "TZ"]);
  });
  it("fills every placeholder in PROMPT.md and REPAIR.md", () => {
    const vars = { DATE: "2026-11-04", WINDOW_START: "a", WINDOW_END: "b", WEEKLY: "false", DEADLINE_LOCAL: "06:40", DRAFT_PATH: "drafts/2026-11-04.json", CONTEXT_PATH: "drafts/context.json", PACK_MD_PATH: "p.md", SCHEMA_PATH: "s.json", STYLE_PATH: "routine/STYLE.md", ERRORS_JSON: "[]" };
    expect(renderTemplate(fs.readFileSync("routine/PROMPT.md", "utf8"), vars)).not.toMatch(/\{\{/);
    expect(renderTemplate(fs.readFileSync("routine/REPAIR.md", "utf8"), vars)).toContain("drafts/2026-11-04.json");
    expect(() => renderTemplate("{{MISSING}}", {})).toThrow(/MISSING/);
  });
});

describe("applyDraft", () => {
  const ctx = AgentContext.parse(read("fixtures/context/weekday.json"));
  const draft = read("fixtures/briefs/valid-weekday.json") as DraftBrief;
  const incidents = ctx.computed.incidents_last_30d.map((i): Incident => ({
    ...i, date_precision: "day", location_country: i.affected[0]!, location: null, sea: null, serious: false, attribution_note: null,
    host_statement: "yes", casualties: { killed: 0, injured: 0 }, disruption_hours: null, sources: [], seed: false, added: i.date, updated: null,
  }));
  const applied = applyDraft({ incidents, strikes: ctx.recent_strikes, state: ctx.state, forecasts: ctx.open_forecasts, archive: {} }, draft, { publishedAt: "2026-10-28T06:10:00+08:00" });

  it("adds new records and applies updates", () => {
    expect(applied.incidents.map((i) => i.id)).toContain("INC-2026-0131");
    const updated = applied.incidents.find((i) => i.id === "INC-2026-0124")!;
    expect(updated).toMatchObject({ attribution: 3, updated: "2026-10-28" });
    expect(updated.sources.map((s) => s.outlet)).toContain("Finnish National Bureau of Investigation");
    expect(applied.strikes.find((s) => s.id === "STR-2026-0452")).toMatchObject({ verification: 4, updated: "2026-10-28" });
    expect(applied.strikes.at(-1)!.id).toBe("STR-2026-0457");
  });

  it("updates forecasts and state", () => {
    expect(applied.forecasts.find((f) => f.id === "F-2026-014")).toMatchObject({ opened: "2026-10-28", status: "open" });
    expect(applied.forecasts.find((f) => f.id === "F-2026-011")!.updates.at(-1)).toMatchObject({ date: "2026-10-28", probability: 12 });
    expect(applied.state.as_of).toBe("2026-10-28");
    expect(applied.state.pathways[0]!.serious_odds.probability).toBe(35);
    expect(applied.state.indicators.find((i) => i.id === "ind-airspace-tempo")).toMatchObject({ status: "active", since: "2026-10-28" });
    expect(applied.state.countries.find((c) => c.country === "PL")!.since).toBe("2026-10-06");
  });

  it("computes the brief's numbers and serializes stable files", () => {
    expect(applied.brief.computed.source_count).toBe(draft.sources.length);
    expect(applied.brief.computed.pathways.airspace.incidents_30d).toBe(5);
    const files = serialize(applied);
    expect([...files.keys()].sort()).toEqual(["archive-index.json", "briefs/2026-10-28.json", "forecasts.json", "incidents/2026.json", "state.json", "strikes/2026.json"]);
    expect(Object.keys(JSON.parse(files.get("briefs/2026-10-28.json")!)).slice(-2)).toEqual(["published_at", "computed"]);
    expect(taipeiTimestamp(new Date("2026-10-27T22:10:00Z"))).toBe("2026-10-28T06:10:00+08:00");
  });

  it("resolves forecasts with Brier scores and the citing source", () => {
    const monday = read("fixtures/briefs/valid-monday.json") as DraftBrief;
    const mctx = AgentContext.parse(read("fixtures/context/monday.json"));
    const a = applyDraft({ incidents: [], strikes: mctx.recent_strikes, state: mctx.state, forecasts: mctx.open_forecasts, archive: {} }, monday, { publishedAt: "2026-10-26T06:10:00+08:00" });
    expect(a.forecasts.find((f) => f.id === "F-2026-005")).toMatchObject({ status: "resolved_no", resolved_on: "2026-10-26", brier: 0.16, brier_base: 0.3025 });
    expect(a.forecasts.find((f) => f.id === "F-2026-005")!.resolution_source!.outlet).toBe("Reuters");
    expect(a.state.weekly!.as_of).toBe("2026-10-26");
  });
});

describe("summary", () => {
  const draft = read("fixtures/briefs/valid-weekday.json") as DraftBrief;
  const state = AgentContext.parse(read("fixtures/context/weekday.json")).state;
  const facts = { started: "2026-10-27T21:30:00Z", finished: "2026-10-27T22:14:00Z", attempts: 1, repairs: 1 };

  it("formats a published run in at most 15 lines", () => {
    const s = renderSummary({ kind: "published", date: "2026-10-28", brief: draft, state, liveUrl: "https://europetracker.vercel.app/brief/2026-10-28", words: 1234, facts });
    expect(s).toContain("**EuropeTracker 2026-10-28 — published**");
    expect(s).toContain("Rung 3 (Overt military incidents, no deaths) · next-rung odds: Highly unlikely (15%) · live at https://europetracker.vercel.app/brief/2026-10-28");
    expect(s).toContain("Run: started 05:30, finished 06:14 · attempts 1, repairs 1 · 17 sources from 11 categories · 1234 words");
    expect(s.trim().split("\n").length).toBeLessThanOrEqual(15);
    expect(changes(draft, state)).toEqual(["Airspace 30% → 35%", "1 new incident: Poland (rung 3)", "indicators: airspace-tempo → active"]);
  });

  it("formats failed, skipped and dry runs", () => {
    const failed = renderSummary({ kind: "failed", date: "2026-10-28", code: "E_VALIDATION", what: "The draft had errors.", errors: Array.from({ length: 8 }, (_, i) => ({ code: `C${i}`, message: "m" })), nextStep: "rerun", facts });
    expect(failed).toContain("**EuropeTracker 2026-10-28 — failed** (E_VALIDATION)");
    expect(failed.match(/^- C/gm)).toHaveLength(5);
    expect(failed).toContain("Draft and logs: needs-review/2026-10-28/");
    expect(renderSummary({ kind: "skipped", date: "2026-10-28", reason: "Already published." })).toBe("**EuropeTracker 2026-10-28 — skipped.** Already published.\n");
    expect(renderSummary({ kind: "dry_run", date: "2026-10-28", brief: draft, state, liveUrl: null, words: 1, draftPath: "drafts/2026-10-28.json", facts })).toContain("— dry run**");
  });
});

describe("promote", () => {
  it("fast-forwards main to review/DATE and deletes the branch", async () => {
    const base = mkdtemp("et-promote-");
    const remote = path.join(base, "remote.git");
    const work = path.join(base, "work");
    const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
    fs.mkdirSync(work);
    sh(work, "init", "-q", "-b", "main");
    sh(work, "config", "user.name", "t");
    sh(work, "config", "user.email", "t@example.org");
    fs.writeFileSync(path.join(work, "a.txt"), "1");
    sh(work, "add", "-A");
    sh(work, "commit", "-q", "-m", "one");
    sh(work, "remote", "add", "origin", remote);
    sh(work, "push", "-q", "-u", "origin", "main");
    sh(work, "checkout", "-q", "-b", "review/2026-11-04");
    fs.writeFileSync(path.join(work, "a.txt"), "2");
    sh(work, "commit", "-q", "-am", "brief");
    sh(work, "push", "-q", "-u", "origin", "review/2026-11-04");
    sh(work, "checkout", "-q", "main");
    await promote(work, "2026-11-04");
    expect(sh(remote, "log", "-1", "--format=%s", "main")).toBe("brief");
    expect(sh(remote, "branch", "--list", "review/*")).toBe("");
  });
});
