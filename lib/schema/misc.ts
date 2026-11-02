import { z } from "zod";
import { CorrectionId, IsoDate, IsoTimestamp } from "./common";

export const Correction = z.strictObject({
  id: CorrectionId,
  date: IsoDate,
  target: z.strictObject({ kind: z.enum(["brief", "incident", "strike", "forecast"]), id: z.string().min(1) }),
  description: z.string().min(1).describe("≤ 60 words"),
});

export const CorrectionsFile = z.strictObject({
  schema_version: z.literal(1),
  corrections: z.array(Correction),
});

export const ArchiveIndex = z.strictObject({
  schema_version: z.literal(1),
  urls: z.record(z.string(), z.strictObject({ snapshot: z.string().min(1), at: IsoTimestamp })),
});

/** `logs/DATE.evidence.json`: every URL the agent could legitimately cite (SPEC §7.10). */
export const EvidenceFile = z.strictObject({ urls: z.array(z.string()) });

export type Correction = z.infer<typeof Correction>;
export type CorrectionsFile = z.infer<typeof CorrectionsFile>;
export type ArchiveIndex = z.infer<typeof ArchiveIndex>;
export type EvidenceFile = z.infer<typeof EvidenceFile>;
