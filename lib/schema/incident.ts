import { z } from "zod";
import { INCIDENT_LOCATIONS, INCIDENT_TYPES, PATHWAYS, SEAS } from "../vocab";
import { AttributionLevel, CountryCode, EvidenceSource, IncidentId, IncidentRung, IsoDate, Pathway, words } from "./common";

const TYPE_HELP = `A key of INCIDENT_TYPES[pathway], or "other". ${PATHWAYS
  .map((p) => `${p}: ${Object.keys(INCIDENT_TYPES[p]).join(", ")}`)
  .join("; ")}`;

export const Incident = z.strictObject({
  id: IncidentId,
  date: IsoDate.describe("Local date of occurrence"),
  date_precision: z.enum(["day", "month"]).describe('"month" only for seed records, with date = the 1st'),
  location_country: z.enum(INCIDENT_LOCATIONS).describe("BY, RU or UA only for military_pressure and nuclear"),
  affected: z.array(CountryCode).describe("European countries affected, at least 1; includes location_country if European"),
  location: z.string().max(80).nullable().describe("City, region or sea area"),
  sea: z.enum(SEAS).nullable(),
  pathway: Pathway,
  type: z.string().min(1).describe(TYPE_HELP),
  rung: IncidentRung,
  serious: z.boolean().describe("Meets the pathway's serious-incident threshold (STYLE.md §3)"),
  summary: words("≤ 60 words, factual"),
  attribution: AttributionLevel,
  attribution_note: words("≤ 40 words: who suspects or attributes").nullable(),
  host_statement: z.enum(["yes", "none_yet"]).describe("Has the affected government or agency spoken?"),
  casualties: z.strictObject({ killed: z.int().min(0), injured: z.int().min(0) }),
  disruption_hours: z.number().min(0).nullable().describe("E.g. hours an airport was closed"),
  sources: z.array(EvidenceSource).describe("Non-seed: ≥ 2 from ≥ 2 categories, including the host statement when host_statement is yes"),
  seed: z.boolean(),
  added: IsoDate,
  updated: IsoDate.nullable(),
});

export const IncidentsFile = z.strictObject({
  schema_version: z.literal(1),
  year: z.int().min(2022).max(2100),
  incidents: z.array(Incident),
});

/** The incident fields the agent context carries (SPEC §4.14). */
export const IncidentBrief = Incident.pick({
  id: true, date: true, affected: true, pathway: true, type: true, rung: true, attribution: true, summary: true,
});

export type Incident = z.infer<typeof Incident>;
export type IncidentsFile = z.infer<typeof IncidentsFile>;
export type IncidentBrief = z.infer<typeof IncidentBrief>;
