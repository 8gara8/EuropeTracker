import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BriefView } from "@/components/brief/BriefView";
import { briefPropsFor } from "@/components/brief/props";
import { HeatGrid, LineChart, MonthlyBars } from "@/components/charts";
import { loadContent } from "@/lib/content";
import { longDate, metricValue, windowLabel } from "@/lib/format";
import { parseBlocks, parseInline, section } from "@/lib/markdown";
import { monthlyCounts } from "@/lib/aggregate";
import fs from "node:fs";

const sample = () => loadContent("fixtures/site-content", { fresh: true });

describe("sample site content", () => {
  it("has ten consecutive briefs with one Monday and one quiet day", () => {
    const { briefs, incidents, strikes, forecasts } = sample();
    expect(briefs.map((b) => b.date)).toEqual(Array.from({ length: 10 }, (_, i) => `2026-10-${20 + i}`));
    expect(briefs.filter((b) => b.weekly)).toHaveLength(1);
    expect(briefs.filter((b) => b.quiet_day)).toHaveLength(1);
    expect(briefs.every((b) => b.title.startsWith("SAMPLE —"))).toBe(true);
    expect(new Set(incidents.map((i) => i.pathway)).size).toBe(7);
    expect(incidents.length).toBeGreaterThanOrEqual(35);
    expect(strikes.length).toBeGreaterThanOrEqual(15);
    expect(forecasts.filter((f) => f.status !== "open")).toHaveLength(3);
  });

  it("renders every brief without throwing", () => {
    const content = sample();
    for (const b of content.briefs) {
      const html = renderToStaticMarkup(<BriefView {...briefPropsFor(content, b.date)!} />);
      expect(html).toContain(b.title.replace(/'/g, "&#x27;"));
      expect(html).toContain(`id="src-${b.sources[0]!.id}"`);
      if (b.weekly) expect(html).toContain("Standing assumptions");
    }
  });
});

describe("weekly outlook", () => {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  it("shows the assumption text each check assessed, even after a later revision", () => {
    const content = sample();
    const monday = content.briefs.find((b) => b.weekly)!;
    const check = monday.weekly_outlook!.assumptions_check[0]!;
    const assumption = content.state.assumptions.find((a) => a.id === check.id)!;
    expect(check.text).toBe(assumption.text);
    assumption.text = "SAMPLE: a later brief revised this assumption.";
    const html = renderToStaticMarkup(<BriefView {...briefPropsFor(content, monday.date)!} />);
    expect(html).toContain(esc(check.text));
    expect(html).toContain(esc(check.note));
    expect(html).toContain(`>${check.status}<`);
    expect(html).not.toContain("a later brief revised");
  });
});

describe("charts", () => {
  it("render SVG with a data table", () => {
    const line = renderToStaticMarkup(<LineChart series={[{ name: "Rung", points: [{ x: "2026-10-20", y: 3 }, { x: "2026-10-21", y: 3 }] }]} step ariaLabel="Rung" />);
    expect(line).toContain("<svg");
    expect(line).toContain("<table");
    const bars = renderToStaticMarkup(<MonthlyBars months={monthlyCounts(sample().incidents, "2026-10-29")} ariaLabel="Incidents" />);
    expect(bars).toContain("Oct 2026 · Airspace");
    const grid = renderToStaticMarkup(<HeatGrid rows={[{ key: "airspace", label: "Airspace" }]} columns={["2026-10-28"]} cells={{ airspace: { "2026-10-28": { term: "unlikely", title: "35%" } } }} ariaLabel="Grid" />);
    expect(grid).toContain("var(--p-unlikely)");
  });

  it("render nothing without data", () => {
    expect(renderToStaticMarkup(<LineChart series={[]} ariaLabel="Empty" />)).toBe("");
  });
});

describe("format", () => {
  it("formats dates, windows and metric values", () => {
    expect(longDate("2026-10-28")).toBe("Wednesday 28 October 2026");
    expect(windowLabel({ start: "2026-10-27T05:30:00+08:00", end: "2026-10-28T05:30:00+08:00" })).toBe("27 Oct 05:30 – 28 Oct 05:30 Taipei");
    expect(metricValue(94.1, "%")).toBe("94.1%");
    expect(metricValue(1420, "count")).toBe("1,420");
    expect(metricValue(18, "km2")).toBe("18 km²");
    expect(metricValue(66.4, "USD/bbl")).toBe("66.4 USD/bbl");
  });
});

describe("markdown", () => {
  it("parses inline bold, code and links", () => {
    expect(parseInline("A **bold** `code` [link](https://example.org) end")).toEqual([
      { kind: "text", text: "A " }, { kind: "bold", text: "bold" }, { kind: "text", text: " " },
      { kind: "code", text: "code" }, { kind: "text", text: " " }, { kind: "link", text: "link", href: "https://example.org" },
      { kind: "text", text: " end" },
    ]);
  });

  it("parses nested lists, tables and paragraphs", () => {
    const blocks = parseBlocks("Intro line\ncontinues.\n\n- one\n  - nested\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "list", "table"]);
    const list = blocks[1] as Extract<(typeof blocks)[number], { kind: "list" }>;
    expect(list.items).toHaveLength(2);
    expect(list.items[0]!.children?.kind).toBe("list");
  });

  it("finds the STYLE.md sections the methodology page renders", () => {
    const md = fs.readFileSync("routine/STYLE.md", "utf8");
    for (const n of [1, 4, 10, 12, 14]) expect(section(md, n)?.body.length).toBeGreaterThan(100);
    expect(section(md, 99)).toBeNull();
  });
});
