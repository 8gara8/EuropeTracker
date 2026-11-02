import { addDays } from "../dates";
import { error, warning, type Rule, type ValidationIssue } from "./types";

// FORECAST_NEW, FORECAST_OPEN_CAP, FORECAST_REF, ASSUMPTION_REF, WEEKLY_ASSUMPTIONS.

export const FORECAST_LIMITS = { newPerDay: 3, open: 30, maxDays: 400 } as const;

export const forecastRules: Rule = ({ draft, date, context, derived }) => {
  const out: ValidationIssue[] = [];

  if (draft.forecasts_new.length > FORECAST_LIMITS.newPerDay) {
    out.push(error("FORECAST_NEW", "forecasts_new", `${draft.forecasts_new.length} new forecasts; at most ${FORECAST_LIMITS.newPerDay} a day.`));
  }
  const latest = addDays(date, FORECAST_LIMITS.maxDays);
  draft.forecasts_new.forEach((f, i) => {
    const at = `forecasts_new[${i}]`;
    if (!f.question.trim().endsWith("?")) out.push(error("FORECAST_NEW", `${at}.question`, `${f.id}: write the question as a binary question ending in "?".`));
    if (!(f.resolves_by > date && f.resolves_by <= latest)) {
      out.push(error("FORECAST_NEW", `${at}.resolves_by`, `${f.id}: resolves_by must be after ${date} and no later than ${latest} (got ${f.resolves_by}).`));
    }
    if (!Number.isInteger(f.probability) || f.probability < 1 || f.probability > 99) {
      out.push(error("FORECAST_NEW", `${at}.probability`, `${f.id}: probability must be an integer from 1 to 99 (got ${f.probability}).`));
    }
  });

  // Citations can be checked without the day-before context, so published briefs get this check too.
  draft.forecast_resolutions.forEach((r, i) => {
    if (!derived.sourcesById.has(r.source_id)) {
      out.push(error("FORECAST_REF", `forecast_resolutions[${i}].source_id`, `Source id ${r.source_id} doesn't exist in sources; cite the source that settles ${r.id}.`));
    }
  });

  if (!context) return out;

  const open = new Map(context.open_forecasts.map((f) => [f.id, f]));
  draft.forecast_updates.forEach((u, i) => {
    if (!open.has(u.id)) out.push(error("FORECAST_REF", `forecast_updates[${i}].id`, `${u.id} isn't an open forecast; check open_forecasts in the context.`));
  });
  const resolved = new Set<string>();
  draft.forecast_resolutions.forEach((r, i) => {
    const at = `forecast_resolutions[${i}]`;
    const f = open.get(r.id);
    if (!f) out.push(error("FORECAST_REF", `${at}.id`, `${r.id} isn't an open forecast; check open_forecasts in the context.`));
    if (resolved.has(r.id)) out.push(error("FORECAST_REF", `${at}.id`, `${r.id} is resolved twice.`));
    resolved.add(r.id);
    if (f && r.outcome === "no" && date < f.resolves_by) {
      out.push(warning("FORECAST_REF", `${at}.outcome`, `${r.id} resolves "no" before its date (${f.resolves_by}); check it can no longer happen.`));
    }
  });

  const openAfter = open.size + draft.forecasts_new.length - [...resolved].filter((id) => open.has(id)).length;
  if (openAfter > FORECAST_LIMITS.open) {
    out.push(error("FORECAST_OPEN_CAP", "forecasts_new", `${openAfter} forecasts would be open; the cap is ${FORECAST_LIMITS.open}. Resolve or skip some.`));
  }

  const assumptions = new Map(context.state.assumptions.map((a) => [a.id, a]));
  draft.assumption_updates.forEach((u, i) => {
    const at = `assumption_updates[${i}]`;
    if (u.op === "add") {
      if (u.id !== null) out.push(error("ASSUMPTION_REF", `${at}.id`, "An added assumption gets its id at publish; set id to null."));
    } else {
      const a = u.id === null ? undefined : assumptions.get(u.id);
      if (!a) out.push(error("ASSUMPTION_REF", `${at}.id`, `${u.op} needs the id of an existing assumption (got ${u.id}).`));
      else if (a.status !== "active") out.push(error("ASSUMPTION_REF", `${at}.id`, `${u.id} is already retired.`));
    }
    if ((u.op === "add" || u.op === "revise") && !u.text?.trim()) {
      out.push(error("ASSUMPTION_REF", `${at}.text`, `${u.op} needs the assumption's text (≤ 40 words).`));
    }
  });

  if (draft.weekly_outlook) {
    const active = context.state.assumptions.filter((a) => a.status === "active").map((a) => a.id).sort();
    const listed = draft.weekly_outlook.assumptions_check.map((a) => a.id);
    const sorted = [...listed].sort();
    if (sorted.join() !== active.join()) {
      out.push(error("WEEKLY_ASSUMPTIONS", "weekly_outlook.assumptions_check",
        `assumptions_check must list each active assumption exactly once: ${active.join(", ") || "none"} (got ${listed.join(", ") || "none"}).`));
    }
  }
  return out;
};
