import { ID_PATTERNS } from "../schema/common";
import { error, type Rule, type ValidationIssue } from "./types";

// INDICATOR_CHANGE, INDICATOR_NEW.

export const indicatorRules: Rule = ({ draft, context }) => {
  if (!context) return [];
  const out: ValidationIssue[] = [];
  const current = new Map(context.state.indicators.map((x) => [x.id, x.status]));
  const changed = new Set<string>();

  draft.indicator_changes.forEach((c, i) => {
    const at = `indicator_changes[${i}]`;
    const status = current.get(c.id);
    if (status === undefined) {
      out.push(error("INDICATOR_CHANGE", `${at}.id`, `${c.id} isn't a known indicator; use an id from state.indicators, or add it under indicators_new.`));
    } else if (status === c.to) {
      out.push(error("INDICATOR_CHANGE", `${at}.to`, `${c.id} is already "${c.to}"; list status changes only.`));
    }
    if (changed.has(c.id)) out.push(error("INDICATOR_CHANGE", `${at}.id`, `${c.id} is changed twice; keep one change.`));
    changed.add(c.id);
    if (c.source_ids.length === 0) out.push(error("INDICATOR_CHANGE", `${at}.source_ids`, `The change to ${c.id} needs at least one source id.`));
  });

  const added = new Set<string>();
  draft.indicators_new.forEach((n, i) => {
    const at = `indicators_new[${i}]`;
    if (!ID_PATTERNS.indicator.test(n.id)) {
      out.push(error("INDICATOR_NEW", `${at}.id`, `"${n.id}" isn't a valid indicator id; use ind- followed by lower-case letters, digits and hyphens.`));
    }
    if (current.has(n.id) || added.has(n.id)) {
      out.push(error("INDICATOR_NEW", `${at}.id`, `${n.id} already exists; choose a new id or use indicator_changes.`));
    }
    added.add(n.id);
    if (n.source_ids.length === 0) out.push(error("INDICATOR_NEW", `${at}.source_ids`, `New indicator ${n.id} needs at least one source id.`));
  });
  return out;
};
