// Site-wide settings, read at build time.

export const SITE_NAME = "EuropeTracker";
export const SITE_DESCRIPTION = "A daily morning brief on the risk of the Russia-Ukraine war spilling into Europe: by which routes, where, and what changed in the last 24 hours.";

export function siteUrl(): string {
  return (process.env.ET_SITE_URL || "https://europetracker.vercel.app").replace(/\/+$/, "");
}

/** True when the site is built from anything other than the real content folder. */
export function isSampleData(): boolean {
  const dir = process.env.ET_CONTENT_DIR;
  return !!dir && dir.replace(/\/+$/, "") !== "content";
}
