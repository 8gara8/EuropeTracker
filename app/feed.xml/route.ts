import { loadContent } from "@/lib/content";
import { longDate, rfc822 } from "@/lib/format";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

export const dynamic = "force-static";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS 2.0 of the last 30 briefs (SPEC §5). */
export function GET() {
  const base = siteUrl();
  const items = loadContent().briefs.slice(-30).reverse().map((b) => {
    const link = `${base}/brief/${b.date}`;
    return `    <item>
      <title>${escape(`${longDate(b.date)}: ${b.title}`)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rfc822(b.published_at)}</pubDate>
      <description>${escape(b.bottom_line)}</description>
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${base}</link>
    <description>${escape(SITE_DESCRIPTION)}</description>
    <language>en</language>
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
