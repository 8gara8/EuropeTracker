// Calendar helpers. Dates are "YYYY-MM-DD" strings handled as UTC calendar days, so no local timezone
// leaks in. Taipei is UTC+8 with no daylight saving; Kyiv uses Intl because it does.

const DAY_MS = 86_400_000;
const TAIPEI_OFFSET_MS = 8 * 3_600_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(date: string): boolean {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === date;
}

function toUtcMs(date: string): number {
  if (!isValidDate(date)) throw new Error(`Invalid date: ${date}`);
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function taipeiToday(now: Date = new Date()): string {
  return fromUtcMs(now.getTime() + TAIPEI_OFFSET_MS);
}

/** The Taipei calendar date of an ISO timestamp. */
export function taipeiDateOf(timestamp: string): string {
  return fromUtcMs(Date.parse(timestamp) + TAIPEI_OFFSET_MS);
}

/** "HH:MM" in Taipei for an ISO timestamp or Date. */
export function taipeiTime(at: string | Date): string {
  const ms = typeof at === "string" ? Date.parse(at) : at.getTime();
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(11, 16);
}

/** The 24 hours to 05:30 Taipei on `date` (SPEC §4.4). */
export function windowFor(date: string): { start: string; end: string } {
  return { start: `${addDays(date, -1)}T05:30:00+08:00`, end: `${date}T05:30:00+08:00` };
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function isMonday(date: string): boolean {
  return new Date(toUtcMs(date)).getUTCDay() === 1;
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** "YYYY-MM" for a date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Every "YYYY-MM" from `from` to `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return months;
}

/** True when `date` lies in [from, to], both inclusive. */
export function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

/** The Kyiv calendar date of an ISO timestamp. */
export function kyivDateOf(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date(timestamp));
}

/** "HH:MM" Kyiv time for an ISO timestamp, for labelled display ("21:14 Kyiv"). */
export function kyivTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date(timestamp));
}
