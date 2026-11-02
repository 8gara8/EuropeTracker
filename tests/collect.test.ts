import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  capItems, classifyDomain, dedupe, feedDate, feedUrl, inWindow, jaccard, parseTelegram, renderPackMd, rssItems,
  rssParser, score, stripOutletSuffix, zoneOf, type Candidate,
} from "@/lib/collect";
import { windowFor } from "@/lib/dates";
import { Pack, SourceRegistry, type Feed } from "@/lib/schema/pack";
import { buildPack, candidates, feedStatus, loadRegistry } from "@/scripts/collect";

const rss = rssParser();
const window = windowFor("2026-11-03"); // 2026-11-02T05:30+08:00 → 2026-11-03T05:30+08:00

const telegram: Feed = { id: "sample-tg", name: "Sample Air Force", kind: "telegram", channel: "samplechannel", category: "ua_gov", language: "uk", coverage: ["russian_strikes", "airspace"], priority: 1 };
const news: Feed = { id: "sample-rss", name: "Sample News", kind: "rss", url: "https://example.org/sample/rss", category: "intl_press", language: "en", coverage: ["airspace", "maritime"], priority: 2 };
const gnews: Feed = { id: "q-sample", name: "Google News: sample", kind: "gnews", query: "dron przestrzeń", hl: "pl", gl: "PL", coverage: ["airspace"], priority: 2 };
const registry: SourceRegistry = { schema_version: 1, domains: { "notesfrompoland.com": "eu_regional_press" }, keywords: ["drone", "dron"], feeds: [telegram, news, gnews] };

describe("parsers", () => {
  it("reads Telegram web previews, skipping reply quotes and posts without text", () => {
    const items = parseTelegram(fs.readFileSync("fixtures/collect/telegram.html", "utf8"));
    expect(items.map((i) => i.url)).toEqual(["https://t.me/samplechannel/101", "https://t.me/samplechannel/102", "https://t.me/samplechannel/90"]);
    expect(items[1]!.snippet).toBe("SAMPLE: course toward Lutsk.");
    expect(items[0]!.published_at).toBe("2026-11-02T20:57:07+00:00");
  });

  it("reads RSS and Google News items, with the outlet from <source>", async () => {
    const plain = rssItems(await rss.parseString(fs.readFileSync("fixtures/collect/rss.xml", "utf8")));
    expect(plain).toHaveLength(4);
    expect(plain[0]!.snippet).toContain("Polish jets scrambled");
    const google = rssItems(await rss.parseString(fs.readFileSync("fixtures/collect/gnews.xml", "utf8")));
    expect(google[0]).toMatchObject({ outlet: "Notes from Poland", outletUrl: "https://notesfrompoland.com" });
    expect(stripOutletSuffix(google[0]!.title, google[0]!.outlet)).toBe("SAMPLE: Dron nad Lubelszczyzną");
  });

  it("reads the IAEA's short local dates and the EU Council's Atom <updated>", async () => {
    const channel = (head: string, item: string) =>
      `<?xml version="1.0"?><rss xmlns:a10="http://www.w3.org/2005/Atom" version="2.0"><channel><title>Sample</title>` +
      `<link>https://example.org</link><description>Sample</description>${head}<item><title>SAMPLE</title>` +
      `<link>https://example.org/a</link>${item}</item></channel></rss>`;
    const iaea = rssItems(await rss.parseString(channel(
      "<pubDate>Fri, 30 Oct 26 17:50:00 +0100</pubDate>", "<pubDate>\n26-10-30  17:50\n</pubDate>")));
    expect(iaea[0]!.published_at).toBe("2026-10-30T16:50:00.000Z");
    const council = rssItems(await rss.parseString(channel("", "<a10:updated>2026-10-30T18:50:00+01:00</a10:updated>")));
    expect(council[0]!.published_at).toBe("2026-10-30T17:50:00.000Z");
  });

  it("never reads a date without a zone as Kobol's local time", () => {
    expect(feedDate("Mon, 02 Nov 2026 20:40:00 GMT")).toBe("2026-11-02T20:40:00.000Z");
    expect(feedDate("Fri, 30 Oct 2026 17:50:00")).toBe("2026-10-30T17:50:00.000Z");
    expect(feedDate("Fri, 30 Oct 2026 17:50:00", "-05:00")).toBe("2026-10-30T22:50:00.000Z");
    expect(feedDate("2026-10-30T17:50:00", "+02:00")).toBe("2026-10-30T15:50:00.000Z");
    expect(feedDate("2026-10-30")).toBe("2026-10-30T00:00:00.000Z");
    expect(feedDate("not a date")).toBeNull();
    expect(feedDate(undefined)).toBeNull();
    expect(zoneOf("Fri, 30 Oct 26 17:50:00 +0100")).toBe("+01:00");
    expect(zoneOf("Sun, 01 Nov 2026 17:00:00 GMT")).toBe("Z");
  });

  it("builds feed URLs", () => {
    expect(feedUrl(telegram)).toBe("https://t.me/s/samplechannel");
    expect(feedUrl(gnews)).toBe("https://news.google.com/rss/search?q=dron%20przestrze%C5%84%20when%3A1d&hl=pl&gl=PL&ceid=PL:pl");
  });
});

describe("selection", () => {
  it("keeps items from six hours before the window to its end", () => {
    expect(inWindow("2026-11-01T15:30:00Z", window)).toBe(true); // window start − 6 h
    expect(inWindow("2026-11-01T15:29:00Z", window)).toBe(false);
    expect(inWindow("2026-11-02T21:30:00Z", window)).toBe(true); // window end
    expect(inWindow("2026-11-02T21:31:00Z", window)).toBe(false);
    expect(inWindow(null, window)).toBe(false);
  });

  it("classifies outlets by domain, including subdomains", () => {
    expect(classifyDomain("https://www.notesfrompoland.com/x", registry.domains)).toBe("eu_regional_press");
    expect(classifyDomain("https://news.notesfrompoland.com", registry.domains)).toBe("eu_regional_press");
    expect(classifyDomain("https://unknown.example", registry.domains)).toBe("unclassified");
    expect(classifyDomain(undefined, registry.domains)).toBe("unclassified");
  });

  it("scores priority, keywords, recency and official sources", () => {
    const item = { title: "drone over the border", snippet: "", published_at: window.end, category: "ua_gov" };
    expect(score(item, 1, ["drone"], window)).toBe(30 + 3 + 5 + 4);
    expect(score({ ...item, category: "intl_press", published_at: "2026-11-01T15:30:00Z" }, 3, [], window)).toBe(10);
  });

  it("drops duplicate URLs and near-identical titles, keeping the higher-priority copy", () => {
    const base = { outlet: "x", category: "intl_press" as const, language: "en", lead_only: false, published_at: window.end, snippet: "" };
    const items: Candidate[] = [
      { ...base, feed_id: "low", title: "Russian drone shot down over eastern Poland", url: "https://a.example/1", coverage: ["airspace"], score: 30, priority: 3 },
      { ...base, feed_id: "high", title: "Russian drone shot down over eastern Poland!", url: "https://b.example/2", coverage: ["resolve"], score: 20, priority: 1 },
      { ...base, feed_id: "dup-url", title: "Different words entirely", url: "https://b.example/2?utm_source=x", coverage: ["airspace"], score: 10, priority: 2 },
    ];
    const kept = dedupe(items);
    expect(kept.map((k) => k.feed_id)).toEqual(["high"]);
    expect(kept[0]!.coverage.sort()).toEqual(["airspace", "resolve"]);
    expect(jaccard("a b c d e", "a b c d f")).toBeCloseTo(4 / 6);
  });

  it("caps each coverage category, then the total", () => {
    const base = { outlet: "x", category: "intl_press" as const, language: "en", lead_only: false, published_at: window.end, snippet: "", feed_id: "f", priority: 2 as const };
    const many: Candidate[] = Array.from({ length: 50 }, (_, i) => ({ ...base, title: `t${i}`, url: `https://x.example/${i}`, coverage: [i % 2 ? "airspace" : "nuclear"], score: i }));
    const capped = capItems(many, 10, 15);
    expect(capped).toHaveLength(15);
    expect(capped[0]!.score).toBe(49);
  });
});

describe("pack", () => {
  it("builds a valid pack from fixture feeds and renders it for the agent", async () => {
    const dead: Feed = { ...news, id: "dead", name: "Dead Feed" };
    const results = [
      { feed: telegram, ok: true, error: null, items: parseTelegram(fs.readFileSync("fixtures/collect/telegram.html", "utf8")) },
      { feed: news, ok: true, error: null, items: rssItems(await rss.parseString(fs.readFileSync("fixtures/collect/rss.xml", "utf8"))) },
      { feed: gnews, ok: true, error: null, items: rssItems(await rss.parseString(fs.readFileSync("fixtures/collect/gnews.xml", "utf8"))) },
      { feed: dead, ok: false, error: "HTTP 404", items: [] },
    ];
    const pack = buildPack("2026-11-03", results, registry, "2026-11-03T05:31:00+08:00");
    expect(Pack.safeParse(pack).success).toBe(true);
    expect(pack.degraded).toBe(false);
    // Telegram: 2 in window (the old post is out); RSS: the near-duplicate and the undated item are dropped.
    expect(pack.items.map((i) => i.feed_id).sort()).toEqual(["q-sample", "q-sample", "sample-rss", "sample-rss", "sample-tg", "sample-tg"]);
    const google = pack.items.find((i) => i.outlet === "Notes from Poland")!;
    expect(google).toMatchObject({ category: "eu_regional_press", lead_only: true, language: "pl" });
    expect(pack.items.find((i) => i.outlet === "Unknown Blog")!.category).toBe("unclassified");
    const md = renderPackMd(pack, { feeds: [...registry.feeds, dead] });
    expect(md).toContain("## airspace");
    expect(md).toContain("(lead: search for the original article)");
    expect(md).toContain("Failed feeds: Dead Feed.");
    expect(md).toContain("[p0001]");
  });

  it("flags a degraded pack when 40% of feeds fail", () => {
    const results = [0, 1, 2, 3, 4].map((i) => ({ feed: { ...news, id: `f${i}` }, ok: i >= 2, error: i < 2 ? "timeout" : null, items: [] }));
    expect(buildPack("2026-11-03", results, registry).degraded).toBe(true);
  });

  it("reports a feed whose items have no readable date", () => {
    const item = { title: "t", url: "https://x.example", snippet: "", published_at: null };
    expect(feedStatus({ feed: news, ok: true, error: null, items: [item] })).toBe("NODATE");
    expect(feedStatus({ feed: news, ok: true, error: null, items: [item, { ...item, published_at: window.end }] })).toBe("ok");
    expect(feedStatus({ feed: news, ok: true, error: null, items: [] })).toBe("ok");
    expect(feedStatus({ feed: news, ok: false, error: "HTTP 404", items: [] })).toBe("FAIL");
  });

  it("keeps per-feed candidates inside the window only", () => {
    const c = candidates(telegram, parseTelegram(fs.readFileSync("fixtures/collect/telegram.html", "utf8")), registry, window);
    expect(c.map((x) => x.url)).toEqual(["https://t.me/samplechannel/101", "https://t.me/samplechannel/102"]);
  });
});

describe("the committed registry", () => {
  const reg = loadRegistry();
  it("meets SPEC §4.12", () => {
    expect(reg.feeds.length).toBeGreaterThanOrEqual(60);
    expect(reg.feeds.length).toBeLessThanOrEqual(90);
    expect(Object.keys(reg.domains).length).toBeGreaterThanOrEqual(80);
    expect(reg.keywords.length).toBeGreaterThanOrEqual(60);
    expect(new Set(reg.feeds.map((f) => f.id)).size).toBe(reg.feeds.length);
  });
  it("has at least three feeds per coverage category and a query in each frontline language", async () => {
    const { CATEGORIES } = await import("@/lib/vocab");
    for (const c of CATEGORIES) expect(reg.feeds.filter((f) => f.coverage.includes(c)).length, c).toBeGreaterThanOrEqual(3);
    for (const [gl, hl] of [["PL", "pl"], ["LT", "lt"], ["LV", "lv"], ["EE", "et"], ["FI", "fi"], ["RO", "ro"], ["MD", "ro"]]) {
      expect(reg.feeds.some((f) => f.kind === "gnews" && f.gl === gl && f.hl === hl), gl).toBe(true);
    }
  });
});
