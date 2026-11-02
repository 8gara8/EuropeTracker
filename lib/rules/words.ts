import type { DraftBrief } from "../schema/draft-brief";
import { countWords } from "../text";
import { error, type Rule, type ValidationIssue } from "./types";

// WORDS_OVER and WORDS_UNDER: per-field budgets (SPEC §4.4) and the TOTAL_WORDS range.

interface WordField {
  path: string;
  text: string | null;
  min?: number;
  max?: number;
  /** Counts toward TOTAL_WORDS. */
  total: boolean;
}

export const TOTAL_WORDS = { min: 600, max: 2000, quietMin: 250 } as const;

export function wordFields(d: DraftBrief): WordField[] {
  const f: WordField[] = [];
  const add = (path: string, text: string | null, total: boolean, max?: number, min?: number) =>
    f.push({ path, text, total, max, min });

  add("bottom_line", d.bottom_line, true, 120, 40);
  add("board.ladder.rationale", d.board.ladder.rationale, true, 60);
  d.board.pathways.forEach((p, i) => add(`board.pathways[${i}].rationale`, p.rationale, true, 40));
  d.board.countries.forEach((c, i) => add(`board.countries[${i}].reason`, c.reason, true, 40));
  d.developments.forEach((x, i) => {
    add(`developments[${i}].summary`, x.summary, true, 80, 20);
    add(`developments[${i}].russian_framing`, x.russian_framing, true, 40);
  });
  d.categories.forEach((c, i) => add(`categories[${i}].text`, c.text, true, c.status === "material" ? 60 : undefined));
  d.incidents_new.forEach((x, i) => {
    add(`incidents_new[${i}].summary`, x.summary, true, 60);
    add(`incidents_new[${i}].attribution_note`, x.attribution_note, true, 40);
  });
  d.incident_updates.forEach((x, i) => {
    add(`incident_updates[${i}].changes.summary`, x.changes.summary, false, 60);
    add(`incident_updates[${i}].changes.attribution_note`, x.changes.attribution_note, false, 40);
    add(`incident_updates[${i}].reason`, x.reason, false, 40);
  });
  d.strikes_new.forEach((x, i) => {
    add(`strikes_new[${i}].summary`, x.summary, true, 50);
    add(`strikes_new[${i}].damage`, x.damage, true, 30);
    add(`strikes_new[${i}].effect`, x.effect, true, 30);
  });
  d.strike_updates.forEach((x, i) => {
    add(`strike_updates[${i}].changes.summary`, x.changes.summary, false, 50);
    add(`strike_updates[${i}].changes.damage`, x.changes.damage, false, 30);
    add(`strike_updates[${i}].changes.effect`, x.changes.effect, false, 30);
    add(`strike_updates[${i}].reason`, x.reason, false, 40);
  });
  d.indicator_changes.forEach((x, i) => add(`indicator_changes[${i}].evidence`, x.evidence, true, 50));
  d.indicators_new.forEach((x, i) => {
    add(`indicators_new[${i}].description`, x.description, false, 50);
    add(`indicators_new[${i}].evidence`, x.evidence, false, 50);
  });
  if (d.quiet_day) add("judgement.text", d.judgement.text, true, 250, 60);
  else add("judgement.text", d.judgement.text, true, 400, 150);
  add("judgement.change_my_mind", d.judgement.change_my_mind, true, 50);
  d.judgement.competing_explanations.forEach((c, i) => {
    add(`judgement.competing_explanations[${i}].subject`, c.subject, false, 20);
    c.hypotheses.forEach((h, j) => {
      add(`judgement.competing_explanations[${i}].hypotheses[${j}].label`, h.label, false, 12);
      add(`judgement.competing_explanations[${i}].hypotheses[${j}].assessment`, h.assessment, true, 40);
    });
  });
  d.forecasts_new.forEach((x, i) => add(`forecasts_new[${i}].base_rate_note`, x.base_rate_note, false, 40));
  d.forecast_updates.forEach((x, i) => add(`forecast_updates[${i}].note`, x.note, false, 30));
  d.forecast_resolutions.forEach((x, i) => add(`forecast_resolutions[${i}].note`, x.note, false, 40));
  d.assumption_updates.forEach((x, i) => {
    add(`assumption_updates[${i}].text`, x.text, false, 40);
    add(`assumption_updates[${i}].reason`, x.reason, false, 40);
  });
  // An empty taiwan field is TAIWAN_EMPTY, not WORDS_UNDER.
  add("taiwan", d.taiwan, true, 150, d.taiwan.trim() === "" ? undefined : 1);
  d.next_72h.forEach((x, i) => {
    add(`next_72h[${i}].event`, x.event, true, 25);
    add(`next_72h[${i}].why`, x.why, true, 25);
  });
  if (d.weekly_outlook) {
    const w = d.weekly_outlook;
    add("weekly_outlook.medium_term.text", w.medium_term.text, false, 200);
    add("weekly_outlook.long_term.text", w.long_term.text, false, 200);
    w.assumptions_check.forEach((a, i) => add(`weekly_outlook.assumptions_check[${i}].note`, a.note, false, 30));
    add("weekly_outlook.calibration_note", w.calibration_note, false, 80);
  }
  d.metrics.forEach((m, i) => add(`metrics[${i}].note`, m.note, false, 20));
  return f;
}

/** TOTAL_WORDS (SPEC §4.4): the sum of the counted fields. */
export function totalWords(d: DraftBrief): number {
  return wordFields(d).reduce((sum, f) => sum + (f.total ? countWords(f.text) : 0), 0);
}

export const wordRules: Rule = ({ draft }) => {
  const out: ValidationIssue[] = [];
  for (const f of wordFields(draft)) {
    if (f.text === null) continue;
    const n = countWords(f.text);
    if (f.max !== undefined && n > f.max) {
      out.push(error("WORDS_OVER", f.path, `${f.path} has ${n} words; the limit is ${f.max}. Cut at least ${n - f.max}.`));
    }
    if (f.min !== undefined && n < f.min) {
      out.push(error("WORDS_UNDER", f.path, `${f.path} has ${n} words; the minimum is ${f.min}. Add at least ${f.min - n}.`));
    }
  }
  const total = totalWords(draft);
  const min = draft.quiet_day ? TOTAL_WORDS.quietMin : TOTAL_WORDS.min;
  if (total > TOTAL_WORDS.max) {
    out.push(error("WORDS_OVER", "(total)", `The brief has ${total} counted words; the hard cap is ${TOTAL_WORDS.max}. Cut at least ${total - TOTAL_WORDS.max}, starting with the longest category notes and development summaries.`));
  }
  if (total < min) {
    out.push(error("WORDS_UNDER", "(total)", `The brief has ${total} counted words; the minimum is ${min}${draft.quiet_day ? " on a quiet day" : ""}. ${draft.quiet_day ? "Expand the judgement." : "If fewer than 3 developments are material, set quiet_day to true; otherwise expand the judgement and notes."}`));
  }
  return out;
};
