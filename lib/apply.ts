import type { IncidentUpdate, StrikeUpdate } from "./schema/draft-brief";
import type { Incident } from "./schema/incident";
import type { Strike } from "./schema/strike";

// Merging a draft's updates into existing records. Shared by the validator (to compute the rung and
// floors after today's changes) and by publish.ts (to write them).

/** The record with the update's non-null changes applied. Sources and dates are publish's job. */
export function applyIncidentChanges<T extends Pick<Incident, "attribution" | "rung"> & Partial<Incident>>(
  rec: T,
  u: IncidentUpdate,
): T {
  const c = u.changes;
  return {
    ...rec,
    attribution: c.attribution ?? rec.attribution,
    rung: c.rung ?? rec.rung,
    ...(c.attribution_note !== null && { attribution_note: c.attribution_note }),
    ...(c.serious !== null && { serious: c.serious }),
    ...(c.casualties !== null && { casualties: c.casualties }),
    ...(c.disruption_hours !== null && { disruption_hours: c.disruption_hours }),
    ...(c.summary !== null && { summary: c.summary }),
  };
}

export function applyStrikeChanges<T extends Pick<Strike, "verification"> & Partial<Strike>>(rec: T, u: StrikeUpdate): T {
  const c = u.changes;
  return {
    ...rec,
    verification: c.verification ?? rec.verification,
    ...(c.damage !== null && { damage: c.damage }),
    ...(c.effect !== null && { effect: c.effect }),
    ...(c.summary !== null && { summary: c.summary }),
    ...(c.weapon_detail !== null && { weapon_detail: c.weapon_detail }),
    ...(c.western_weapon !== null && { western_weapon: c.western_weapon }),
  };
}
