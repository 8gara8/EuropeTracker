// Source-pack collector (SPEC §7.3).
//   tsx scripts/collect.ts [--date YYYY-MM-DD]   → research/packs/DATE.json and DATE.md
//   tsx scripts/collect.ts --check-feeds         → table of every feed; exit 1 if a priority-1 feed fails
// Exit codes: 0 on success (including a degraded pack), 1 on an invalid registry or zero items kept.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Parser from "rss-parser";
import YAML from "yaml";
import {
  USER_AGENT, capItems, classifyDomain, dedupe, feedUrl, inWindow, parseTelegram, renderPackMd, rssItems,
  score, stripOutletSuffix, toPackItems, LIMITS, type Candidate, type RawItem,
} from "../lib/collect";
import { isValidDate, taipeiToday, windowFor } from "../lib/dates";
import { Pack, SourceRegistry, type Feed } from "../lib/schema/pack";

export const REGISTRY_PATH = "research/sources.yaml";
const CONCURRENCY = 8;
const FEED_TIMEOUT_MS = 15_000;
const TOTAL_CAP_MS = 180_000;

const rss = new Parser({ customFields: { item: [["source", "source", { keepArray: true }]] } });

export function loadRegistry(file = REGISTRY_PATH): SourceRegistry {
  return SourceRegistry.parse(YAML.parse(fs.readFileSync(file, "utf8")));
}

async function fetchText(url: string, deadline: number): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("collector time cap reached");
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8" },
        signal: AbortSignal.timeout(Math.min(FEED_TIMEOUT_MS, remaining)),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function readFeed(feed: Feed, deadline: number): Promise<RawItem[]> {
  const body = await fetchText(feedUrl(feed), deadline);
  if (feed.kind === "telegram") return parseTelegram(body);
  return rssItems(await rss.parseString(body));
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }));
  return out;
}

interface FeedResult { feed: Feed; ok: boolean; items: RawItem[]; error: string | null }

async function fetchAll(registry: SourceRegistry): Promise<FeedResult[]> {
  const deadline = Date.now() + TOTAL_CAP_MS;
  return pool(registry.feeds, CONCURRENCY, async (feed) => {
    try {
      return { feed, ok: true, items: await readFeed(feed, deadline), error: null };
    } catch (e) {
      return { feed, ok: false, items: [], error: (e as Error).message.slice(0, 200) };
    }
  });
}

/** Turns one feed's raw items into scored candidates inside the window. */
export function candidates(feed: Feed, items: RawItem[], registry: SourceRegistry, window: { start: string; end: string }): Candidate[] {
  return items.filter((i) => inWindow(i.published_at, window)).map((i) => {
    const gnews = feed.kind === "gnews";
    const category = feed.kind === "gnews" ? classifyDomain(i.outletUrl, registry.domains) : feed.category;
    const title = (gnews ? stripOutletSuffix(i.title, i.outlet) : i.title).slice(0, LIMITS.titleChars);
    const published_at = new Date(Date.parse(i.published_at!)).toISOString();
    const base = {
      feed_id: feed.id,
      outlet: gnews ? i.outlet ?? "Google News" : feed.name,
      category,
      language: feed.kind === "gnews" ? feed.hl.split("-")[0]! : feed.language,
      coverage: [...feed.coverage],
      title,
      url: i.url,
      lead_only: gnews,
      published_at,
      snippet: i.snippet.slice(0, LIMITS.snippetChars),
      priority: feed.priority,
    };
    return { ...base, score: score(base, feed.priority, registry.keywords, window) };
  });
}

export function buildPack(date: string, results: FeedResult[], registry: SourceRegistry, generatedAt = new Date().toISOString()): Pack {
  const window = windowFor(date);
  const all = results.flatMap((r) => candidates(r.feed, r.items, registry, window));
  const kept = capItems(dedupe(all));
  const feeds = results.map((r) => ({
    id: r.feed.id,
    ok: r.ok,
    items_total: r.items.length,
    items_kept: kept.filter((k) => k.feed_id === r.feed.id).length,
    error: r.error,
  }));
  const failed = feeds.filter((f) => !f.ok).length;
  return Pack.parse({
    schema_version: 1,
    date,
    window,
    generated_at: generatedAt,
    degraded: feeds.length > 0 && failed / feeds.length >= 0.4,
    feeds,
    items: toPackItems(kept),
  });
}

async function checkFeeds(registry: SourceRegistry): Promise<number> {
  const results = await fetchAll(registry);
  let badPriority1 = 0;
  console.log(["id", "ok", "items", "newest", "priority", "error"].join("\t"));
  for (const r of results) {
    const newest = r.items.map((i) => i.published_at).filter(Boolean).sort().at(-1) ?? "-";
    if (!r.ok && r.feed.priority === 1) badPriority1 += 1;
    console.log([r.feed.id, r.ok ? "ok" : "FAIL", r.items.length, newest, r.feed.priority, r.error ?? ""].join("\t"));
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} of ${results.length} feeds ok; ${badPriority1} priority-1 failures.`);
  return badPriority1 ? 1 : 0;
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { date: { type: "string" }, "check-feeds": { type: "boolean" } } });
  let registry: SourceRegistry;
  try {
    registry = loadRegistry();
  } catch (e) {
    console.error(`${REGISTRY_PATH} is invalid: ${(e as Error).message}`);
    return 1;
  }
  if (values["check-feeds"]) return checkFeeds(registry);

  const date = values.date ?? taipeiToday();
  if (!isValidDate(date)) {
    console.error(`Invalid --date ${date}`);
    return 1;
  }
  const pack = buildPack(date, await fetchAll(registry), registry);
  const dir = "research/packs";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${date}.json`), `${JSON.stringify(pack, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, `${date}.md`), renderPackMd(pack, registry));
  const failed = pack.feeds.filter((f) => !f.ok);
  console.log(`Pack ${date}: ${pack.items.length} items from ${pack.feeds.length - failed.length}/${pack.feeds.length} feeds${pack.degraded ? " (DEGRADED)" : ""}.`);
  if (failed.length) console.log(`Failed: ${failed.map((f) => `${f.id} (${f.error})`).join(", ")}`);
  return pack.items.length ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(e); process.exitCode = 1; });
}
