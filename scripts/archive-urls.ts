// Requests Wayback Machine snapshots of today's cited URLs (SPEC §7.8). Runs detached after publish.
// Results go to logs/archive-index.pending.json; the next publish merges them into content/, so the
// working tree stays clean between runs. Failures are only logged.
//   tsx scripts/archive-urls.ts --date YYYY-MM-DD

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { USER_AGENT } from "../lib/collect";
import { loadContent } from "../lib/content";
import { normalizeUrl } from "../lib/urls";
import { RunLog } from "./lib/log";
import { PENDING_ARCHIVE } from "./publish";

const MAX_URLS = 30;
const GAP_MS = 15_000;
const TIMEOUT_MS = 20_000;

async function snapshot(url: string): Promise<string | null> {
  const res = await fetch(`https://web.archive.org/save/${url}`, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status !== 200 && res.status !== 302) return null;
  const where = res.headers.get("content-location") ?? res.headers.get("location");
  if (!where) return null;
  return where.startsWith("http") ? where : `https://web.archive.org${where}`;
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { date: { type: "string" } } });
  if (!values.date) return 2;
  const log = new RunLog(`logs/${values.date}.archive.log`, false);
  const content = loadContent("content", { fresh: true });
  const brief = content.briefs.find((b) => b.date === values.date);
  if (!brief) {
    log.line(`No published brief for ${values.date}; nothing to archive.`);
    return 0;
  }
  const pending: Record<string, { snapshot: string; at: string }> = fs.existsSync(PENDING_ARCHIVE) ? JSON.parse(fs.readFileSync(PENDING_ARCHIVE, "utf8")) : {};
  const done = new Set([...Object.keys(content.archive), ...Object.keys(pending)].map(normalizeUrl));
  const todo = [...new Set(brief.sources.map((s) => s.url))].filter((u) => !done.has(normalizeUrl(u))).slice(0, MAX_URLS);
  log.line(`Archiving ${todo.length} URLs for ${values.date}.`);
  for (const [i, url] of todo.entries()) {
    if (i) await new Promise((r) => setTimeout(r, GAP_MS));
    try {
      const snap = await snapshot(url);
      if (snap) {
        pending[normalizeUrl(url)] = { snapshot: snap, at: new Date().toISOString() };
        fs.mkdirSync(path.dirname(PENDING_ARCHIVE), { recursive: true });
        fs.writeFileSync(PENDING_ARCHIVE, `${JSON.stringify(pending, null, 2)}\n`);
        log.line(`ok ${url}`);
      } else log.line(`no snapshot for ${url}`);
    } catch (e) {
      log.line(`failed ${url}: ${(e as Error).message}`);
    }
  }
  return 0;
}

main().then((code) => { process.exitCode = code; });
