import { addDays, isMonday, windowFor } from "../dates";
import { METRICS } from "../vocab";
import { error, type Rule, type ValidationIssue } from "./types";

// DATE_MISMATCH, WINDOW_MISMATCH, WEEKLY_FLAG, NEXT72_DATE, METRIC_UNIT, METRIC_DUP, METRIC_SOURCE,
// TAIWAN_EMPTY.

export const metaRules: Rule = ({ draft, date, fileDate }) => {
  const out: ValidationIssue[] = [];

  if (draft.date !== date) {
    out.push(error("DATE_MISMATCH", "date", `date is ${draft.date} but the run date is ${date}; set "date" to "${date}".`));
  } else if (fileDate && draft.date !== fileDate) {
    out.push(error("DATE_MISMATCH", "date", `date is ${draft.date} but the file is named ${fileDate}.json; they must match.`));
  }

  const w = windowFor(date);
  if (draft.window.start !== w.start || draft.window.end !== w.end) {
    out.push(error("WINDOW_MISMATCH", "window",
      `window must be exactly {"start": "${w.start}", "end": "${w.end}"}.`));
  }

  const monday = isMonday(date);
  if (draft.weekly !== monday) {
    out.push(error("WEEKLY_FLAG", "weekly", `${date} is ${monday ? "" : "not "}a Monday; set "weekly" to ${monday}.`));
  }
  if (monday && draft.weekly_outlook === null) {
    out.push(error("WEEKLY_FLAG", "weekly_outlook", `${date} is a Monday, so weekly_outlook is required (STYLE.md §13).`));
  }
  if (!monday && draft.weekly_outlook !== null) {
    out.push(error("WEEKLY_FLAG", "weekly_outlook", `${date} is not a Monday; set weekly_outlook to null.`));
  }

  const last = addDays(date, 3);
  draft.next_72h.forEach((e, i) => {
    if (!(e.date > date && e.date <= last)) {
      out.push(error("NEXT72_DATE", `next_72h[${i}].date`,
        `${e.date} is outside the next 72 hours; use a date from ${addDays(date, 1)} to ${last}, or drop the event.`));
    }
  });

  const seen = new Set<string>();
  draft.metrics.forEach((m, i) => {
    const expected = METRICS[m.id].unit;
    if (m.unit !== expected) {
      out.push(error("METRIC_UNIT", `metrics[${i}].unit`, `${m.id} is measured in "${expected}"; set unit to "${expected}" (got "${m.unit}").`));
    }
    if (seen.has(m.id)) {
      out.push(error("METRIC_DUP", `metrics[${i}].id`, `${m.id} appears more than once; keep one entry.`));
    }
    seen.add(m.id);
    if (m.value !== null && m.source_ids.length === 0) {
      out.push(error("METRIC_SOURCE", `metrics[${i}].source_ids`, `${m.id} has a value but no source; cite at least one source id or set value to null.`));
    }
  });

  if (draft.taiwan.trim() === "") {
    out.push(error("TAIWAN_EMPTY", "taiwan",
      'The "Impact on Taiwan" section is empty; write how today\'s developments might affect Taiwan, or use exactly the no-news line from STYLE.md §14.'));
  }

  return out;
};
