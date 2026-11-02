import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Brief } from "./schema/brief";
import { Forecast, ForecastsFile } from "./schema/forecast";
import { Incident, IncidentsFile } from "./schema/incident";
import { ArchiveIndex, Correction, CorrectionsFile } from "./schema/misc";
import { State } from "./schema/state";
import { Strike, StrikesFile } from "./schema/strike";
import { contentDir } from "./site";

export { contentDir };

// Reading content/ (or whatever ET_CONTENT_DIR points at). `readRawContent` never throws, so the
// validator can report every problem; `loadContent` parses strictly and throws, for the site build
// and the scripts.

export interface RawFile {
  /** Path relative to the content dir, e.g. "incidents/2026.json". */
  file: string;
  data: unknown;
}

export interface RawContent {
  dir: string;
  briefs: RawFile[];
  incidents: RawFile[];
  strikes: RawFile[];
  state: RawFile | null;
  forecasts: RawFile | null;
  corrections: RawFile | null;
  archiveIndex: RawFile | null;
  /** Files that are missing or aren't valid JSON. */
  problems: { file: string; message: string }[];
}

function readJson(dir: string, file: string, problems: RawContent["problems"]): RawFile | null {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    problems.push({ file, message: "File is missing" });
    return null;
  }
  try {
    return { file, data: JSON.parse(fs.readFileSync(full, "utf8")) };
  } catch (e) {
    problems.push({ file, message: `Not valid JSON: ${(e as Error).message}` });
    return null;
  }
}

function readFolder(dir: string, sub: string, problems: RawContent["problems"]): RawFile[] {
  const full = path.join(dir, sub);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson(dir, `${sub}/${f}`, problems))
    .filter((f): f is RawFile => f !== null);
}

export function readRawContent(dir: string = contentDir()): RawContent {
  const problems: RawContent["problems"] = [];
  return {
    dir,
    briefs: readFolder(dir, "briefs", problems),
    incidents: readFolder(dir, "incidents", problems),
    strikes: readFolder(dir, "strikes", problems),
    state: readJson(dir, "state.json", problems),
    forecasts: readJson(dir, "forecasts.json", problems),
    corrections: readJson(dir, "corrections.json", problems),
    archiveIndex: readJson(dir, "archive-index.json", problems),
    problems,
  };
}

export interface Content {
  dir: string;
  /** Sorted by date, oldest first. */
  briefs: Brief[];
  /** All years, sorted by date then id. */
  incidents: Incident[];
  strikes: Strike[];
  state: State;
  forecasts: Forecast[];
  corrections: Correction[];
  /** Normalized URL → Wayback snapshot. */
  archive: Record<string, { snapshot: string; at: string }>;
}

export class ContentError extends Error {}

function parse<T>(schema: z.ZodType<T>, raw: RawFile | null, label: string): T {
  if (!raw) throw new ContentError(`${label} is missing`);
  const r = schema.safeParse(raw.data);
  if (!r.success) {
    const first = r.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ContentError(`${raw.file} is invalid (run npm run validate:all): ${first}`);
  }
  return r.data;
}

const byDateThenId = <T extends { date: string; id: string }>(a: T, b: T) =>
  a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date);

const cache = new Map<string, Content>();

/** Strictly parsed content. Throws ContentError on the first invalid file. Cached per directory. */
export function loadContent(dir: string = contentDir(), { fresh = false } = {}): Content {
  const hit = cache.get(dir);
  if (hit && !fresh) return hit;
  const raw = readRawContent(dir);
  const fatal = raw.problems.find((p) => p.message !== "File is missing" || p.file === "state.json");
  if (fatal) throw new ContentError(`${fatal.file}: ${fatal.message}`);

  const content: Content = {
    dir,
    briefs: raw.briefs.map((f) => parse(Brief, f, f.file)).sort((a, b) => a.date.localeCompare(b.date)),
    incidents: raw.incidents.flatMap((f) => parse(IncidentsFile, f, f.file).incidents).sort(byDateThenId),
    strikes: raw.strikes.flatMap((f) => parse(StrikesFile, f, f.file).strikes).sort(byDateThenId),
    state: parse(State, raw.state, "state.json"),
    forecasts: raw.forecasts ? parse(ForecastsFile, raw.forecasts, "forecasts.json").forecasts : [],
    corrections: raw.corrections ? parse(CorrectionsFile, raw.corrections, "corrections.json").corrections : [],
    archive: raw.archiveIndex ? parse(ArchiveIndex, raw.archiveIndex, "archive-index.json").urls : {},
  };
  cache.set(dir, content);
  return content;
}
