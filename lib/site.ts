// Site-wide settings, read at build time.

export const SITE_NAME = "EuropeTracker";
export const SITE_DESCRIPTION = "A daily morning brief on the risk of the Russia-Ukraine war spilling into Europe: by which routes, where, and what changed in the last 24 hours.";

export function siteUrl(): string {
  return (process.env.ET_SITE_URL || "https://europetracker.vercel.app").replace(/\/+$/, "");
}

/** The content folder: ET_CONTENT_DIR, except that a review/DATE preview builds from the real content (SPEC §8.1). */
export function contentDir(): string {
  if (process.env.VERCEL_GIT_COMMIT_REF?.startsWith("review/")) return "content";
  return process.env.ET_CONTENT_DIR || "content";
}

/** True when the site is built from anything other than the real content folder. */
export function isSampleData(): boolean {
  return contentDir().replace(/\/+$/, "") !== "content";
}
