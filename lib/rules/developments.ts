import { NO_CHANGE_TEXT } from "../vocab";
import { categoriesOf, error, knownSourceIds, type Rule, type ValidationIssue } from "./types";

// DEV_COUNT, PIVOTAL_MAX, DEV_SOURCES, DEV_LADDER, CATEGORY_TEXT.

export const developmentRules: Rule = ({ draft, context, derived }) => {
  const out: ValidationIssue[] = [];
  const devs = draft.developments;

  const [min, max] = draft.quiet_day ? [0, 3] : [3, 8];
  if (devs.length < min || devs.length > max) {
    out.push(error("DEV_COUNT", "developments",
      `${devs.length} developments; ${draft.quiet_day ? "a quiet day allows 0–3" : "a normal day needs 3–8"}.${!draft.quiet_day && devs.length < 3 ? " If fewer than 3 are material, set quiet_day to true." : ""}`));
  }

  const pivotal = devs.filter((d) => d.importance === "pivotal");
  if (pivotal.length > 1) {
    out.push(error("PIVOTAL_MAX", "developments", `${pivotal.length} developments are pivotal (${pivotal.map((d) => d.id).join(", ")}); at most one may be. Mark the others "major".`));
  }

  devs.forEach((d, i) => {
    const at = `developments[${i}]`;
    const ids = knownSourceIds(d.source_ids, derived);
    const cats = categoriesOf(d.source_ids, derived);
    if (d.importance !== "notable" && (ids.length < 2 || cats.size < 2)) {
      out.push(error("DEV_SOURCES", `${at}.source_ids`,
        `${d.id} is ${d.importance}, so it needs at least 2 sources from at least 2 source categories (has ${ids.length} from ${cats.size}). Add a source from another category or mark it "notable".`));
    } else if (ids.length < 1) {
      out.push(error("DEV_SOURCES", `${at}.source_ids`, `${d.id} needs at least one source id.`));
    }

    if (!context) return;
    const incidents = d.incident_ids.map((id) => ({ id, rec: derived.incidentsById.get(id) }));
    const unknownInc = incidents.filter((x) => !x.rec).map((x) => x.id);
    if (unknownInc.length) {
      out.push(error("DEV_LADDER", `${at}.incident_ids`, `${d.id} refers to unknown incidents: ${unknownInc.join(", ")}.`));
    } else if (incidents.length) {
      const maxAttr = Math.max(...incidents.map((x) => x.rec!.attribution));
      if (d.attribution !== maxAttr) {
        out.push(error("DEV_LADDER", `${at}.attribution`, `${d.id}: attribution must be ${maxAttr}, the highest attribution among ${d.incident_ids.join(", ")}.`));
      }
    } else if (d.attribution !== null) {
      out.push(error("DEV_LADDER", `${at}.attribution`, `${d.id} has no incident_ids, so attribution must be null.`));
    }

    const strikes = d.strike_ids.map((id) => ({ id, rec: derived.strikesById.get(id) }));
    const unknownStr = strikes.filter((x) => !x.rec).map((x) => x.id);
    if (unknownStr.length) {
      out.push(error("DEV_LADDER", `${at}.strike_ids`, `${d.id} refers to unknown strikes: ${unknownStr.join(", ")}.`));
    } else if (strikes.length) {
      const maxVer = Math.max(...strikes.map((x) => x.rec!.verification));
      if (d.verification !== maxVer) {
        out.push(error("DEV_LADDER", `${at}.verification`, `${d.id}: verification must be ${maxVer}, the highest verification among ${d.strike_ids.join(", ")}.`));
      }
    } else if (d.verification !== null) {
      out.push(error("DEV_LADDER", `${at}.verification`, `${d.id} has no strike_ids, so verification must be null.`));
    }
  });

  const devIds = new Set(devs.map((d) => d.id));
  draft.categories.forEach((c, i) => {
    const at = `categories[${i}]`;
    if (c.status === "no_change" && c.text !== NO_CHANGE_TEXT) {
      out.push(error("CATEGORY_TEXT", `${at}.text`, `${c.category} is no_change, so its text must be exactly "${NO_CHANGE_TEXT}"; or set status to "material".`));
    }
    if (c.status === "material" && c.text.trim() === NO_CHANGE_TEXT) {
      out.push(error("CATEGORY_TEXT", `${at}.status`, `${c.category} says "${NO_CHANGE_TEXT}" but is marked material; set status to "no_change".`));
    }
    if (c.status === "material" && c.source_ids.length === 0) {
      out.push(error("CATEGORY_TEXT", `${at}.source_ids`, `${c.category} is material, so it needs at least one source id.`));
    }
    const unknown = c.development_ids.filter((id) => !devIds.has(id));
    if (unknown.length) {
      out.push(error("CATEGORY_TEXT", `${at}.development_ids`, `${c.category} refers to unknown developments: ${unknown.join(", ")}.`));
    }
  });
  return out;
};
