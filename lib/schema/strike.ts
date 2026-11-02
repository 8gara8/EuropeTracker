import { z } from "zod";
import { STRIKE_TARGET_TYPES, WEAPON_TYPES } from "../vocab";
import { EvidenceSource, IsoDate, StrikeId, VerificationLevel, words } from "./common";

export const Strike = z.strictObject({
  id: StrikeId,
  date: IsoDate.describe("Kyiv date of the strike; for night strikes, the date the night began"),
  target_name: z.string().min(1).max(100),
  target_type: z.enum(STRIKE_TARGET_TYPES),
  region: z.string().min(1).max(60).describe("Russian region or occupied area"),
  occupied_territory: z.boolean(),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
  distance_km: z.number().min(0).nullable().describe("Approximate distance from the nearest Ukraine-controlled territory"),
  weapon: z.enum(WEAPON_TYPES),
  weapon_detail: z.string().max(40).nullable(),
  western_weapon: z.boolean().nullable().describe("Only if a source says so; otherwise null"),
  verification: VerificationLevel,
  damage: words("≤ 30 words; required at verification ≥ 4").nullable(),
  effect: words("≤ 30 words; required at verification 5").nullable(),
  summary: words("≤ 50 words"),
  sources: z.array(EvidenceSource).describe("Must include the evidence each verification level needs (STYLE.md §6)"),
  seed: z.boolean(),
  added: IsoDate,
  updated: IsoDate.nullable(),
});

export const StrikesFile = z.strictObject({
  schema_version: z.literal(1),
  year: z.int().min(2022).max(2100),
  strikes: z.array(Strike),
});

export type Strike = z.infer<typeof Strike>;
export type StrikesFile = z.infer<typeof StrikesFile>;
