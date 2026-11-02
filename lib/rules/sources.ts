import type { DraftBrief } from "../schema/draft-brief";
import { isGoogleNewsUrl, isHttpsUrl, normalizeUrl } from "../urls";
import { categoriesOf, error, knownSourceIds, warning, type Rule, type ValidationIssue } from "./types";

// SOURCE_REF, SOURCE_DUP, SOURCE_URL, SOURCE_MIN, SOURCE_SIDES, SOURCE_UNSEEN, SOURCE_ORPHAN,
// BOTTOM_LINE_SOURCES.

export const SOURCE_MINIMUMS = { sources: 10, categories: 7, quietSources: 5, quietCategories: 4 } as const;

/** Every source-id reference in the brief, with its path. Forecast resolutions are FORECAST_REF's. */
export function sourceRefs(d: DraftBrief): { path: string; id: string }[] {
  const refs: { path: string; id: string }[] = [];
  const add = (path: string, ids: string[]) => ids.forEach((id, j) => refs.push({ path: `${path}[${j}]`, id }));
  add("bottom_line_source_ids", d.bottom_line_source_ids);
  d.board.pathways.forEach((p, i) => add(`board.pathways[${i}].source_ids`, p.source_ids));
  d.board.countries.forEach((c, i) => add(`board.countries[${i}].source_ids`, c.source_ids));
  d.developments.forEach((x, i) => add(`developments[${i}].source_ids`, x.source_ids));
  d.categories.forEach((x, i) => add(`categories[${i}].source_ids`, x.source_ids));
  d.indicator_changes.forEach((x, i) => add(`indicator_changes[${i}].source_ids`, x.source_ids));
  d.indicators_new.forEach((x, i) => add(`indicators_new[${i}].source_ids`, x.source_ids));
  d.metrics.forEach((x, i) => add(`metrics[${i}].source_ids`, x.source_ids));
  return refs;
}

/** Every cited URL: the brief's sources plus the evidence on new records and updates. */
export function citedUrls(d: DraftBrief): { path: string; url: string }[] {
  const urls: { path: string; url: string }[] = [];
  d.sources.forEach((s, i) => urls.push({ path: `sources[${i}].url`, url: s.url }));
  d.incidents_new.forEach((x, i) => x.sources.forEach((s, j) => urls.push({ path: `incidents_new[${i}].sources[${j}].url`, url: s.url })));
  d.strikes_new.forEach((x, i) => x.sources.forEach((s, j) => urls.push({ path: `strikes_new[${i}].sources[${j}].url`, url: s.url })));
  d.incident_updates.forEach((x, i) => x.add_sources.forEach((s, j) => urls.push({ path: `incident_updates[${i}].add_sources[${j}].url`, url: s.url })));
  d.strike_updates.forEach((x, i) => x.add_sources.forEach((s, j) => urls.push({ path: `strike_updates[${i}].add_sources[${j}].url`, url: s.url })));
  return urls;
}

function urlProblem(url: string): string | null {
  if (isGoogleNewsUrl(url)) return "news.google.com links are redirects; open the original article and cite its own URL";
  if (!isHttpsUrl(url)) return /^http:\/\//i.test(url) ? "use the https version of this URL" : "this is not a valid absolute https URL";
  return null;
}

export const sourceRules: Rule = ({ draft, context, evidence, derived }) => {
  const out: ValidationIssue[] = [];
  const d = draft;

  for (const ref of sourceRefs(d)) {
    if (!derived.sourcesById.has(ref.id)) {
      out.push(error("SOURCE_REF", ref.path, `Source id ${ref.id} doesn't exist in sources; add the source or fix the id.`));
    }
  }

  const seenIds = new Set<string>();
  const seenUrls = new Map<string, string>();
  d.sources.forEach((s, i) => {
    if (seenIds.has(s.id)) out.push(error("SOURCE_DUP", `sources[${i}].id`, `Source id ${s.id} is used twice; give each source a unique id.`));
    seenIds.add(s.id);
    const key = normalizeUrl(s.url);
    const first = seenUrls.get(key);
    if (first) out.push(error("SOURCE_DUP", `sources[${i}].url`, `${s.id} has the same URL as ${first}; merge them into one source.`));
    else seenUrls.set(key, s.id);
  });

  const cited = citedUrls(d);
  const badUrl = new Set<string>();
  for (const { path, url } of cited) {
    const problem = urlProblem(url);
    if (problem) {
      badUrl.add(path);
      out.push(error("SOURCE_URL", path, `${url}: ${problem}.`));
    }
  }

  const count = d.sources.length;
  const cats = new Set(d.sources.map((s) => s.category));
  const [minSources, minCats] = d.quiet_day
    ? [SOURCE_MINIMUMS.quietSources, SOURCE_MINIMUMS.quietCategories]
    : [SOURCE_MINIMUMS.sources, SOURCE_MINIMUMS.categories];
  if (count < minSources || cats.size < minCats) {
    out.push(error("SOURCE_MIN", "sources",
      `${count} sources from ${cats.size} categories; ${d.quiet_day ? "a quiet day needs" : "the brief needs"} at least ${minSources} from ${minCats}.`));
  }

  if (!d.quiet_day) {
    const missing: string[] = [];
    if (!cats.has("ua_gov")) missing.push("a Ukrainian official source (ua_gov)");
    if (!cats.has("ru_gov") && !cats.has("ru_state_media")) missing.push("a Russian official or state source (ru_gov or ru_state_media)");
    if (missing.length) out.push(error("SOURCE_SIDES", "sources", `The brief needs ${missing.join(" and ")}.`));
  }

  if (evidence === null) {
    // Published briefs were checked at publish time; only a draft check without evidence warns.
    if (context) out.push(warning("SOURCE_UNSEEN", "sources", "Skipped: no evidence file was given, so cited URLs weren't checked against what the agent saw."));
  } else {
    for (const { path, url } of cited) {
      if (badUrl.has(path)) continue;
      if (!evidence.has(normalizeUrl(url))) {
        out.push(error("SOURCE_UNSEEN", path,
          `${url} isn't in the source pack or in any page you fetched or search result you saw. Cite only URLs you actually saw, or remove this source.`));
      }
    }
  }

  const referenced = new Set(sourceRefs(d).map((r) => r.id));
  d.forecast_resolutions.forEach((x) => referenced.add(x.source_id));
  const evidenceUrls = new Set(cited.filter((c) => !c.path.startsWith("sources[")).map((c) => normalizeUrl(c.url)));
  d.sources.forEach((s, i) => {
    if (!referenced.has(s.id) && !evidenceUrls.has(normalizeUrl(s.url))) {
      out.push(warning("SOURCE_ORPHAN", `sources[${i}]`, `${s.id} is never referenced; cite it somewhere or drop it.`));
    }
  });

  const blIds = knownSourceIds(d.bottom_line_source_ids, derived);
  const blCats = categoriesOf(d.bottom_line_source_ids, derived);
  if (blIds.length < 2 || blCats.size < 2) {
    out.push(error("BOTTOM_LINE_SOURCES", "bottom_line_source_ids",
      `bottom_line_source_ids needs at least 2 sources from at least 2 categories (has ${blIds.length} from ${blCats.size}).`));
  }
  return out;
};
