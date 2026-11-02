import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isMonday, isValidDate, kyivDateOf, monthsBetween, taipeiDateOf, taipeiToday, windowFor } from "@/lib/dates";
import { inBand, inGap, termFor } from "@/lib/probability";
import { countWords } from "@/lib/text";
import { isGoogleNewsUrl, isHttpsUrl, normalizeUrl, stripArchivePrefix } from "@/lib/urls";
import { METRIC_IDS, METRICS, PROBABILITY_TERM_IDS, PROBABILITY_TERMS, SOURCE_CATEGORIES, SOURCE_CATEGORY_IDS, COUNTRIES, COUNTRY_NAMES } from "@/lib/vocab";

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("The ladder stays at rung 3.")).toBe(6);
  });
  it("counts hyphenated words and numbers as one word each", () => {
    expect(countWords("A 30-day window, 1,800 words and 06:15 Taipei")).toBe(8);
  });
  it("ignores URLs, markdown symbols and stray punctuation", () => {
    expect(countWords("**Bold** text — see https://example.org/a/b?c=d and # - >")).toBe(4);
  });
  it("handles empty and null input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords("   \n ")).toBe(0);
  });
  it("counts words in other scripts", () => {
    expect(countWords("Повітряні сили України")).toBe(3);
  });
});

describe("probability bands", () => {
  it("places numbers in their bands", () => {
    expect(termFor(0)).toBe("remote");
    expect(termFor(5)).toBe("remote");
    expect(termFor(30)).toBe("unlikely");
    expect(termFor(50)).toBe("realistic_possibility");
    expect(termFor(75)).toBe("likely");
    expect(termFor(100)).toBe("almost_certain");
  });
  it("rejects the gaps", () => {
    for (const n of [6, 9, 21, 24, 36, 39, 51, 54, 76, 79, 91, 94]) {
      expect(inGap(n)).toBe(true);
      expect(termFor(n)).toBeNull();
    }
    expect(inGap(10)).toBe(false);
  });
  it("checks a number against a term", () => {
    expect(inBand(30, "unlikely")).toBe(true);
    expect(inBand(30, "likely")).toBe(false);
    expect(inBand(30.5, "unlikely")).toBe(false);
  });
});

describe("dates", () => {
  it("builds the 24-hour window to 05:30 Taipei", () => {
    expect(windowFor("2026-11-03")).toEqual({ start: "2026-11-02T05:30:00+08:00", end: "2026-11-03T05:30:00+08:00" });
    expect(windowFor("2027-01-01").start).toBe("2026-12-31T05:30:00+08:00");
  });
  it("knows Mondays", () => {
    expect(isMonday("2026-11-02")).toBe(true);
    expect(isMonday("2026-11-03")).toBe(false);
    expect(isMonday("2026-10-26")).toBe(true);
  });
  it("adds days across months and years", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-02", -29)).toBe("2026-10-04");
    expect(daysBetween("2026-10-04", "2026-11-02")).toBe(29);
  });
  it("gives Taipei's date for a moment in time", () => {
    expect(taipeiToday(new Date("2026-11-01T21:30:00Z"))).toBe("2026-11-02");
    expect(taipeiToday(new Date("2026-11-01T15:59:00Z"))).toBe("2026-11-01");
    expect(taipeiDateOf("2026-11-02T23:00:00+01:00")).toBe("2026-11-03");
    expect(kyivDateOf("2026-11-02T23:30:00Z")).toBe("2026-11-03");
  });
  it("validates calendar dates and lists months", () => {
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(monthsBetween("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("normalizeUrl", () => {
  it("folds scheme, host case, www, fragments and trailing slashes", () => {
    expect(normalizeUrl("http://WWW.Reuters.com/world/europe/story/#top")).toBe("https://reuters.com/world/europe/story");
    expect(normalizeUrl("https://example.org/")).toBe("https://example.org");
  });
  it("drops tracking parameters and sorts the rest", () => {
    expect(normalizeUrl("https://a.org/x?utm_source=t&b=2&fbclid=z&a=1&gclid=q")).toBe("https://a.org/x?a=1&b=2");
  });
  it("treats Telegram web previews and posts as the same", () => {
    expect(normalizeUrl("https://t.me/s/kpszsu/12345")).toBe(normalizeUrl("https://t.me/kpszsu/12345"));
  });
  it("strips a Wayback prefix", () => {
    expect(stripArchivePrefix("https://web.archive.org/web/20261102053000/https://example.org/a")).toBe("https://example.org/a");
    expect(normalizeUrl("https://web.archive.org/web/20261102053000/https://www.example.org/a/")).toBe("https://example.org/a");
  });
  it("normalizes percent-encoding", () => {
    expect(normalizeUrl("https://a.org/%d0%b4")).toBe(normalizeUrl("https://a.org/д"));
  });
  it("leaves unparseable input alone", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
  it("recognizes https and Google News links", () => {
    expect(isHttpsUrl("https://example.org/a")).toBe(true);
    expect(isHttpsUrl("http://example.org/a")).toBe(false);
    expect(isHttpsUrl("example.org/a")).toBe(false);
    expect(isGoogleNewsUrl("https://news.google.com/rss/articles/abc")).toBe(true);
    expect(isGoogleNewsUrl("https://example.org/news.google.com")).toBe(false);
  });
});

describe("vocab", () => {
  it("keeps the derived id lists in step with the records", () => {
    expect([...PROBABILITY_TERM_IDS].sort()).toEqual(Object.keys(PROBABILITY_TERMS).sort());
    expect([...SOURCE_CATEGORY_IDS].sort()).toEqual(Object.keys(SOURCE_CATEGORIES).sort());
    expect([...METRIC_IDS].sort()).toEqual(Object.keys(METRICS).sort());
  });
  it("names 35 countries plus the threat locations", () => {
    expect(COUNTRIES).toHaveLength(35);
    expect(new Set(COUNTRIES).size).toBe(35);
    expect(Object.keys(COUNTRY_NAMES)).toHaveLength(38);
  });
});
