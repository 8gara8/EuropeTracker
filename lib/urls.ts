// URL normalization for evidence matching and duplicate checks (SPEC §7.10).

const ARCHIVE_RE = /^(?:https?:\/\/)?(?:www\.)?web\.archive\.org\/web\/[^/]+\/(.+)$/i;
const TRACKING_PARAM_RE = /^(?:utm_.*|fbclid|gclid)$/i;
const TELEGRAM_POST_RE = /^\/s\/([^/]+)\/(\d+)$/;

/** Strips a `web.archive.org/web/<timestamp>/` prefix; returns the URL unchanged otherwise. */
export function stripArchivePrefix(url: string): string {
  const m = ARCHIVE_RE.exec(url.trim());
  if (!m) return url.trim();
  const inner = m[1]!;
  return /^https?:\/\//i.test(inner) ? inner : `https://${inner.replace(/^https?:\/+/i, "")}`;
}

/**
 * Canonical form used to compare URLs: https scheme, lower-case host without `www.`, no fragment,
 * no tracking parameters, sorted query, no trailing slash, `t.me/s/<c>/<n>` folded to `t.me/<c>/<n>`,
 * and any Wayback prefix removed. Unparseable input comes back trimmed but otherwise unchanged.
 */
export function normalizeUrl(url: string): string {
  const raw = stripArchivePrefix(url);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return raw;

  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  let path = u.pathname.replace(/%[0-9a-f]{2}/gi, (s) => s.toUpperCase());
  if (host === "t.me") {
    const m = TELEGRAM_POST_RE.exec(path);
    if (m) path = `/${m[1]}/${m[2]}`;
  }
  path = path.replace(/\/+$/, "");

  const params = [...u.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAM_RE.test(key))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  const port = u.port ? `:${u.port}` : "";
  return `https://${host}${port}${path}${query}`;
}

/** True for a well-formed absolute https URL. */
export function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function isGoogleNewsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "news.google.com" || host.endsWith(".news.google.com");
  } catch {
    return /news\.google\.com/i.test(url);
  }
}

/** Every http(s) URL in a block of text, with trailing punctuation trimmed. */
export function extractUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s"'<>\\)\]}]+/gi) ?? [];
  return found.map((u) => u.replace(/[.,;:!?]+$/, ""));
}
