import { inLast30, last30 } from "../aggregate";
import { inBand, termFor } from "../probability";
import type { ProbabilityEstimate } from "../schema/common";
import {
  CATEGORIES, COHESION_WATCH, PATHWAYS, PROBABILITY_TERMS, RUNGS, TIER1, isTier1, isTier2, type CountryCode,
} from "../vocab";
import { error, list, type Rule, type RuleInput, type ValidationIssue } from "./types";

// PROB_TERM, ORDER_PATHWAYS, ORDER_COUNTRIES, ORDER_CATEGORIES, RUNG_COMPUTED, RUNG_PREVIOUS,
// NEXT_ODDS_NULL, TREND, PATHWAY_JUMP_SOURCES, COUNTRY_FLOOR, COUNTRY_CEILING, COUNTRY_REASON,
// COUNTRY_PREVIOUS, COHESION_FLAG.

function estimates(r: RuleInput): { path: string; e: ProbabilityEstimate }[] {
  const d = r.draft;
  const out: { path: string; e: ProbabilityEstimate }[] = [];
  if (d.board.ladder.next_rung_odds) out.push({ path: "board.ladder.next_rung_odds", e: d.board.ladder.next_rung_odds });
  d.board.pathways.forEach((p, i) => out.push({ path: `board.pathways[${i}].serious_odds`, e: p.serious_odds }));
  d.judgement.competing_explanations.forEach((c, i) =>
    c.hypotheses.forEach((h, j) => out.push({ path: `judgement.competing_explanations[${i}].hypotheses[${j}].estimate`, e: h.estimate })));
  if (d.weekly_outlook) {
    out.push({ path: "weekly_outlook.medium_term.estimate", e: d.weekly_outlook.medium_term.estimate });
    out.push({ path: "weekly_outlook.long_term.estimate", e: d.weekly_outlook.long_term.estimate });
  }
  return out;
}

const probTerm: Rule = (r) => {
  const out: ValidationIssue[] = [];
  for (const { path, e } of estimates(r)) {
    if (inBand(e.probability, e.term)) continue;
    const band = PROBABILITY_TERMS[e.term];
    const fits = termFor(e.probability);
    const fix = fits
      ? `set term to "${fits}" or choose a number in ${band.min}–${band.max}`
      : `${e.probability} falls in a gap between bands; choose a number in ${band.min}–${band.max}`;
    out.push(error("PROB_TERM", path, `probability ${e.probability} is outside "${e.term}" (${band.min}–${band.max}%); ${fix}.`));
  }
  return out;
};

const order: Rule = ({ draft }) => {
  const out: ValidationIssue[] = [];
  const pathways = draft.board.pathways.map((p) => p.pathway);
  if (pathways.join() !== PATHWAYS.join()) {
    out.push(error("ORDER_PATHWAYS", "board.pathways", `board.pathways must be exactly the 7 pathways in this order: ${list(PATHWAYS)} (got ${list(pathways) || "none"}).`));
  }

  const countries = draft.board.countries.map((c) => c.country);
  const head = countries.slice(0, TIER1.length);
  const tail = countries.slice(TIER1.length);
  const problems: string[] = [];
  if (head.join() !== TIER1.join()) problems.push(`the first 7 entries must be ${list(TIER1)} in that order`);
  const extra = tail.filter((c) => !isTier2(c));
  if (extra.length) problems.push(`only tier-2 countries may follow (${extra.join(", ")} ${extra.length === 1 ? "is" : "are"} not tier 2)`);
  const dup = countries.filter((c, i) => countries.indexOf(c) !== i);
  if (dup.length) problems.push(`duplicates: ${[...new Set(dup)].join(", ")}`);
  if (problems.length) {
    out.push(error("ORDER_COUNTRIES", "board.countries", `board.countries: ${problems.join("; ")} (got ${list(countries) || "none"}).`));
  }

  const categories = draft.categories.map((c) => c.category);
  if (categories.join() !== CATEGORIES.join()) {
    out.push(error("ORDER_CATEGORIES", "categories", `categories must be exactly the 12 categories in this order: ${list(CATEGORIES)} (got ${list(categories) || "none"}).`));
  }
  return out;
};

const ladder: Rule = ({ draft, date, context, derived }) => {
  const out: ValidationIssue[] = [];
  const l = draft.board.ladder;
  if (l.current_rung < 6 && l.next_rung_odds === null) {
    out.push(error("NEXT_ODDS_NULL", "board.ladder.next_rung_odds", `next_rung_odds is required below rung 6: give the 30-day probability of any incident at rung ${l.current_rung + 1} or higher.`));
  }
  if (l.current_rung === 6 && l.next_rung_odds !== null) {
    out.push(error("NEXT_ODDS_NULL", "board.ladder.next_rung_odds", "At rung 6 there is no higher rung; set next_rung_odds to null."));
  }
  if (!context) return out;

  if (l.current_rung !== derived.computedRung) {
    const { from, to } = last30(date);
    const top = derived.incidentsAfter.filter((i) => inLast30(i, date) && i.rung === derived.computedRung).map((i) => i.id);
    const why = top.length ? `from ${top.slice(0, 3).join(", ")}` : "no incidents in the window";
    out.push(error("RUNG_COMPUTED", "board.ladder.current_rung",
      `The computed rung is ${derived.computedRung} (${RUNGS[derived.computedRung]!.name}: highest rung of incidents dated ${from} to ${to}, including today's additions and updates; ${why}). Set board.ladder.current_rung to ${derived.computedRung}.`));
  }
  if (l.previous_rung !== context.state.ladder.current_rung) {
    out.push(error("RUNG_PREVIOUS", "board.ladder.previous_rung",
      `previous_rung must equal the state's rung, ${context.state.ladder.current_rung}; set board.ladder.previous_rung to ${context.state.ladder.current_rung}.`));
  }
  return out;
};

const pathwayMoves: Rule = ({ draft, context }) => {
  if (!context) return [];
  const out: ValidationIssue[] = [];
  const prev = new Map(context.state.pathways.map((p) => [p.pathway, p.serious_odds.probability]));
  draft.board.pathways.forEach((p, i) => {
    const before = prev.get(p.pathway);
    if (before === undefined) return;
    const delta = p.serious_odds.probability - before;
    const expected = delta >= 5 ? "up" : delta <= -5 ? "down" : "flat";
    if (p.trend !== expected) {
      out.push(error("TREND", `board.pathways[${i}].trend`,
        `${p.pathway} moved from ${before} to ${p.serious_odds.probability} (${delta >= 0 ? "+" : ""}${delta} points), so trend must be "${expected}" (±5 points is the threshold).`));
    }
    if (Math.abs(delta) >= 15 && p.source_ids.length === 0) {
      out.push(error("PATHWAY_JUMP_SOURCES", `board.pathways[${i}].source_ids`,
        `${p.pathway} moved ${Math.abs(delta)} points; a move of 15 or more needs at least one source id in source_ids.`));
    }
  });
  return out;
};

const countries: Rule = ({ draft, context, derived }) => {
  const out: ValidationIssue[] = [];
  const stateScore = new Map(context?.state.countries.map((c) => [c.country as string, c.score]) ?? []);

  draft.board.countries.forEach((c, i) => {
    const at = `board.countries[${i}]`;
    if (c.cohesion_flag && !(COHESION_WATCH as readonly string[]).includes(c.country)) {
      out.push(error("COHESION_FLAG", `${at}.cohesion_flag`, `Only Hungary or Slovakia can carry the cohesion flag; set cohesion_flag to false for ${c.country}.`));
    }
    if (!context) return;

    const { floor, max_rung_30d } = derived.floors[c.country as CountryCode];
    const tier1 = isTier1(c.country);
    const before = tier1 ? stateScore.get(c.country) ?? null : null;

    if (tier1 && c.previous_score !== before) {
      out.push(error("COUNTRY_PREVIOUS", `${at}.previous_score`, `previous_score for ${c.country} must equal the state's score, ${before}.`));
    }
    if (!tier1 && c.previous_score !== null) {
      out.push(error("COUNTRY_PREVIOUS", `${at}.previous_score`, `${c.country} is tier 2, so previous_score must be null.`));
    }

    if (c.score < floor) {
      out.push(error("COUNTRY_FLOOR", `${at}.score`,
        `${c.country} score ${c.score} is below its floor of ${floor} (highest rung affecting it in the last 30 days: ${max_rung_30d}); set score to at least ${floor}.`));
    }

    const qualifying = (id: string) => {
      const ind = derived.indicatorsAfter.get(id);
      return !!ind && ind.tier === "strategic" && ind.status === "active" && ind.countries.includes(c.country);
    };
    const bad = c.indicator_ids.filter((id) => !qualifying(id));
    if (bad.length) {
      out.push(error("COUNTRY_CEILING", `${at}.indicator_ids`,
        `indicator_ids may list only active strategic indicators naming ${c.country}; remove ${bad.join(", ")}.`));
    }
    if (c.score > floor + 1 && !c.indicator_ids.some(qualifying)) {
      out.push(error("COUNTRY_CEILING", `${at}.score`,
        `${c.country} score ${c.score} is more than one above its floor of ${floor}; lower it to ${floor + 1} or less, or list an active strategic indicator naming ${c.country} in indicator_ids.`));
    }

    const changed = tier1 && before !== null && c.score !== before;
    if ((changed || c.score > floor) && !c.reason?.trim()) {
      out.push(error("COUNTRY_REASON", `${at}.reason`,
        `${c.country} needs a reason (≤ 40 words): its score ${changed ? `changed from ${before} to ${c.score}` : `${c.score} is above the floor of ${floor}`}.`));
    }
    if (changed && c.source_ids.length === 0) {
      out.push(error("COUNTRY_REASON", `${at}.source_ids`, `${c.country} changed from ${before} to ${c.score}; cite at least one source id.`));
    }
  });
  return out;
};

export const boardRules: Rule = (r) => [...probTerm(r), ...order(r), ...ladder(r), ...pathwayMoves(r), ...countries(r)];
