import type { ReactNode } from "react";
import { countryName, dayMonth, PATHWAY_SHORT, shortDate } from "@/lib/format";
import type { Incident } from "@/lib/schema/incident";
import { rungRuns, type OddsPoint, type RungPoint, type ScoreRow } from "@/lib/trends";
import { COUNTRY_SCORES, PATHWAYS, RUNGS, type PathwayId, type ProbabilityTerm, type Score } from "@/lib/vocab";
import { dayIndex, Figure, FONT, Legend, Table, W } from "./index";

// Trend charts (SPEC §6): server-rendered SVG like the rest of components/charts. Every mark that carries
// a value has a <title> for the hover readout, and every figure has a data table.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RUNG_SHORT = ["Hostile pressure", "Grey-zone", "Covert attacks", "Overt military", "Deadly or deliberate", "Limited conflict", "General war"];
const mono = { fontSize: FONT, fontFamily: "var(--font-mono)" } as const;
const gridLine = { stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "1 3" } as const;
const pathwayColor = (p: PathwayId) => `var(--pw-${p})`;

/** The first day of each month after `from` up to `to`. */
function monthStarts(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number) as [number, number];
  for (;;) {
    m++;
    if (m > 12) { m = 1; y++; }
    const d = `${y}-${String(m).padStart(2, "0")}-01`;
    if (d > to) return out;
    out.push(d);
  }
}

function yearStarts(from: string, to: string): string[] {
  const out: string[] = [];
  for (let y = Number(from.slice(0, 4)) + 1; `${y}-01-01` <= to; y++) out.push(`${y}-01-01`);
  return out;
}

// ---------------------------------------------------------------------------------------------------

export interface RungChartProps {
  points: RungPoint[];
  /** The first brief's date: days before it are rebuilt from the incident database. */
  trackingStart: string | null;
  ariaLabel: string;
  width?: number;
  height?: number;
  /** Write each rung's name beside its number (wide layouts). */
  names?: boolean;
  ticks?: "month" | "year";
  wide?: boolean;
}

/** The rung by day as a step line, each stretch in its rung's colour over a faint fill. */
export function RungChart({ points, trackingStart, ariaLabel, width = W, height = 150, names = false, ticks = "month", wide = false }: RungChartProps) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const runs = rungRuns(points);
  const m = { l: names ? 136 : 18, r: 34, t: 14, b: 20 };
  const x0 = dayIndex(first.date);
  const x1 = dayIndex(last.date) + 1;
  const sx = (n: number) => m.l + ((n - x0) / (x1 - x0)) * (width - m.l - m.r);
  const sy = (r: number) => m.t + ((6 - r) / 6) * (height - m.t - m.b);
  const base = sy(0);
  const months = monthStarts(first.date, last.date);
  const labelEvery = months.length > 8 ? 2 : 1;
  const tickDates = ticks === "year" ? yearStarts(first.date, last.date) : months;
  const showTracking = trackingStart !== null && trackingStart > first.date && trackingStart <= last.date;

  return (
    <Figure
      ariaLabel={ariaLabel}
      wide={wide}
      table={<Table head={["From", "To", "Rung", "Days"]} rows={[...runs].reverse().map((r) => [r.from, r.to, `${r.rung} ${RUNGS[r.rung]!.name}`, r.days])} />}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {RUNGS.map(({ rung }) => (
          <g key={rung}>
            <line x1={m.l} x2={width - m.r} y1={sy(rung)} y2={sy(rung)} {...gridLine} />
            <text x={m.l - 4} y={sy(rung) + 3.2} textAnchor="end" {...mono} fill={rung >= 3 ? "var(--ink-soft)" : "var(--muted)"}>{names ? `${rung} ${RUNG_SHORT[rung]}` : rung}</text>
          </g>
        ))}
        {runs.map((r, i) => {
          const xa = sx(dayIndex(r.from));
          const xb = sx(dayIndex(r.to) + 1);
          const prev = runs[i - 1];
          const title = `Rung ${r.rung}, ${RUNGS[r.rung]!.name}: ${shortDate(r.from)} to ${shortDate(r.to)} (${r.days} ${r.days === 1 ? "day" : "days"})`;
          return (
            <g key={r.from}>
              <rect x={xa} y={sy(r.rung)} width={Math.max(xb - xa, 0.5)} height={base - sy(r.rung)} fill={`var(--rung-${r.rung})`} opacity={0.12}><title>{title}</title></rect>
              {prev ? <line x1={xa} x2={xa} y1={sy(prev.rung)} y2={sy(r.rung)} stroke="var(--muted)" strokeWidth={1} /> : null}
              <line x1={xa} x2={xb} y1={sy(r.rung)} y2={sy(r.rung)} stroke={`var(--rung-${r.rung})`} strokeWidth={2.5}><title>{title}</title></line>
            </g>
          );
        })}
        <line x1={m.l} x2={width - m.r} y1={base} y2={base} stroke="var(--rule)" strokeWidth={1} />
        {tickDates.map((d, i) => (
          <g key={d}>
            <line x1={sx(dayIndex(d))} x2={sx(dayIndex(d))} y1={base} y2={base + 3} stroke="var(--rule)" strokeWidth={1} />
            {ticks === "year" || i % labelEvery === 0 ? (
              <text x={sx(dayIndex(d))} y={height - 5} textAnchor="middle" {...mono} fill="var(--muted)">
                {ticks === "year" || d.slice(5, 7) === "01" ? d.slice(0, 4) : MONTHS[Number(d.slice(5, 7)) - 1]}
              </text>
            ) : null}
          </g>
        ))}
        {showTracking ? (
          <g>
            <line x1={sx(dayIndex(trackingStart!))} x2={sx(dayIndex(trackingStart!))} y1={m.t - 8} y2={base} stroke="var(--rule)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            <text x={sx(dayIndex(trackingStart!)) - 3} y={m.t - 6} textAnchor="end" fontSize={FONT - 1} fontFamily="var(--font-mono)" fill="var(--ink-soft)">daily briefs →</text>
          </g>
        ) : null}
        <circle cx={sx(x1)} cy={sy(last.rung)} r={3.5} fill={`var(--rung-${last.rung})`} stroke="var(--panel)" strokeWidth={1.5} />
        <text x={sx(x1) + 6} y={sy(last.rung) + 3.2} {...mono} fill="var(--fg)" fontWeight={600}>{`${last.rung} now`}</text>
      </svg>
    </Figure>
  );
}

// ---------------------------------------------------------------------------------------------------

/** Each brief's odds of an incident one rung higher, coloured by the rung those odds are for. */
export function NextRungOddsChart({ points, ariaLabel, height = 150 }: { points: OddsPoint[]; ariaLabel: string; height?: number }) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const m = { l: 30, r: 42, t: 12, b: 20 };
  const x0 = dayIndex(first.date);
  const x1 = dayIndex(last.date) + 1;
  const sx = (n: number) => m.l + ((n - x0) / (x1 - x0)) * (W - m.l - m.r);
  const sy = (p: number) => m.t + ((100 - p) / 100) * (height - m.t - m.b);
  const segments: OddsPoint[][] = [];
  for (const p of points) {
    const seg = segments.at(-1);
    if (seg && seg[0]!.rung === p.rung) seg.push(p); else segments.push([p]);
  }

  return (
    <Figure
      ariaLabel={ariaLabel}
      table={<Table head={["Date", "Odds", "For rung"]} rows={[...points].reverse().map((p) => [p.date, `${p.probability}%`, p.rung])} />}
    >
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} {...gridLine} />
            <text x={m.l - 4} y={sy(t) + 3.2} textAnchor="end" {...mono} fill="var(--muted)">{`${t}%`}</text>
          </g>
        ))}
        {segments.map((seg, i) => {
          const color = `var(--rung-${seg[0]!.rung})`;
          const d = seg.map((p, j) => `${j ? "L" : "M"}${sx(dayIndex(p.date))},${sy(p.probability)}H${sx(dayIndex(p.date) + 1)}`).join("");
          const prev = segments[i - 1]?.at(-1);
          const xs = sx(dayIndex(seg[0]!.date));
          const span = sx(dayIndex(seg.at(-1)!.date) + 1) - xs;
          return (
            <g key={seg[0]!.date}>
              {prev ? <line x1={xs} x2={xs} y1={sy(prev.probability)} y2={sy(seg[0]!.probability)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 2" /> : null}
              <path d={d} fill="none" stroke={color} strokeWidth={2.5} />
              {span > 90 ? <text x={xs + span / 2} y={sy(seg.at(-1)!.probability) - 6} textAnchor="middle" {...mono} fill="var(--ink-soft)">{`odds of rung ${seg[0]!.rung}`}</text> : null}
            </g>
          );
        })}
        {points.map((p) => (
          <rect key={p.date} x={sx(dayIndex(p.date))} y={m.t} width={Math.max(sx(dayIndex(p.date) + 1) - sx(dayIndex(p.date)), 0.5)} height={height - m.t - m.b} fill="transparent">
            <title>{`${dayMonth(p.date)}: ${p.probability}% odds of a rung-${p.rung} incident within 30 days`}</title>
          </rect>
        ))}
        <line x1={m.l} x2={W - m.r} y1={sy(0)} y2={sy(0)} stroke="var(--rule)" strokeWidth={1} />
        <circle cx={sx(x1)} cy={sy(last.probability)} r={3.5} fill={`var(--rung-${last.rung})`} stroke="var(--panel)" strokeWidth={1.5} />
        <text x={sx(x1) + 6} y={sy(last.probability) + 3.2} {...mono} fill="var(--fg)" fontWeight={600}>{`${last.probability}%`}</text>
        <text x={sx(x1) + 6} y={sy(last.probability) + 14} fontSize={FONT - 1} fontFamily="var(--font-mono)" fill="var(--muted)">{`rung ${last.rung}`}</text>
        <text x={m.l} y={height - 5} {...mono} fill="var(--muted)">{dayMonth(first.date)}</text>
        <text x={W - m.r} y={height - 5} textAnchor="end" {...mono} fill="var(--muted)">{dayMonth(last.date)}</text>
      </svg>
    </Figure>
  );
}

// ---------------------------------------------------------------------------------------------------

/** Each frontline country's score in every brief, as a strip of coloured days; triangles mark changes. */
export function ScoreStrip({ rows, ariaLabel }: { rows: ScoreRow[]; ariaLabel: string }) {
  const dates = [...new Set(rows.flatMap((r) => r.points.map((p) => p.date)))].sort();
  if (!dates.length) return null;
  const labelW = 64;
  const right = 66;
  const rowH = 14;
  const gap = 2;
  const cw = (W - labelW - right) / dates.length;
  const height = rows.length * (rowH + gap) + 16;
  const scoreOn = (r: ScoreRow) => new Map(r.points.map((p) => [p.date, p.score]));

  return (
    <Figure
      ariaLabel={ariaLabel}
      legend={<Legend items={([1, 2, 3, 4, 5] as Score[]).map((s) => ({ label: `${s} ${COUNTRY_SCORES[s].label}`, color: `var(--score-${s})` }))} />}
      table={<Table head={["Date", ...rows.map((r) => r.country)]} rows={[...dates].reverse().map((d) => [d, ...rows.map((r) => scoreOn(r).get(d) ?? "–")])} />}
    >
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {rows.map((r, i) => {
          const y = i * (rowH + gap);
          const on = scoreOn(r);
          const current = r.points.at(-1)?.score;
          return (
            <g key={r.country}>
              <text x={labelW - 6} y={y + rowH / 2 + 3.2} textAnchor="end" {...mono} fill="var(--fg)">{countryName(r.country)}</text>
              {dates.map((d, j) => {
                const s = on.get(d);
                const before = j > 0 ? on.get(dates[j - 1]!) : undefined;
                const x = labelW + j * cw;
                const changed = s !== undefined && before !== undefined && s !== before;
                const cx = x + cw / 2;
                const cy = y + rowH / 2;
                const t = Math.min(cw * 0.32, 3.5);
                return (
                  <g key={d}>
                    <rect x={x + 0.3} y={y} width={Math.max(cw - 0.6, 0.4)} height={rowH} fill={s ? `var(--score-${s})` : "transparent"} stroke={s ? "none" : "var(--border)"} strokeWidth={0.5}>
                      <title>{s ? `${countryName(r.country)}, ${dayMonth(d)}: ${s} ${COUNTRY_SCORES[s].label}${changed ? ` (was ${before})` : ""}` : `${countryName(r.country)}, ${dayMonth(d)}: no score`}</title>
                    </rect>
                    {changed ? (
                      <path d={s! > before! ? `M${cx - t},${cy + t * 0.8}L${cx + t},${cy + t * 0.8}L${cx},${cy - t}Z` : `M${cx - t},${cy - t * 0.8}L${cx + t},${cy - t * 0.8}L${cx},${cy + t}Z`} fill="var(--panel)" />
                    ) : null}
                  </g>
                );
              })}
              {current ? <text x={W - right + 6} y={y + rowH / 2 + 3.2} {...mono} fill="var(--fg)">{`${current} ${COUNTRY_SCORES[current].label}`}</text> : null}
            </g>
          );
        })}
        <text x={labelW} y={height - 3} {...mono} fill="var(--muted)">{dayMonth(dates[0]!)}</text>
        <text x={W - right} y={height - 3} textAnchor="end" {...mono} fill="var(--muted)">{dayMonth(dates.at(-1)!)}</text>
      </svg>
    </Figure>
  );
}

// ---------------------------------------------------------------------------------------------------

/** A pathway's incident count over the previous 30 days, sampled weekly: a small line with its latest value. */
export function Sparkline({ points, color, label }: { points: { date: string; count: number }[]; color: string; label: string }) {
  const last = points.at(-1);
  if (!last || points.length < 2) return null;
  const w = 120;
  const h = 26;
  const max = Math.max(1, ...points.map((p) => p.count));
  const sx = (i: number) => 2 + (i / (points.length - 1)) * (w - 6);
  const sy = (n: number) => 3 + ((max - n) / max) * (h - 7);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(i)},${sy(p.count)}`).join("");
  const peak = points.reduce((a, p) => (p.count > a.count ? p : a), points[0]!);
  const summary = `${label}: ${last.count} now, peak ${peak.count} (${dayMonth(peak.date)})`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-[26px] w-[120px]" role="img" aria-label={summary}>
      <title>{summary}</title>
      <path d={`${d}L${sx(points.length - 1)},${sy(0)}L${sx(0)},${sy(0)}Z`} fill={color} opacity={0.12} />
      <line x1={2} x2={w - 4} y1={sy(0)} y2={sy(0)} stroke="var(--border)" strokeWidth={1} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={sx(points.length - 1)} cy={sy(last.count)} r={2.4} fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------

/** Small multiples: each pathway's odds of a serious incident by brief, on the full probability scale. */
export function PathwayOddsGrid({ series, ariaLabel }: { series: Record<PathwayId, { date: string; probability: number; term: ProbabilityTerm }[]>; ariaLabel: string }) {
  const dates = [...new Set(PATHWAYS.flatMap((p) => series[p].map((x) => x.date)))].sort();
  if (!dates.length) return null;
  const w = 200;
  const h = 52;
  const x0 = dayIndex(dates[0]!);
  const x1 = dayIndex(dates.at(-1)!) + 1;
  const sx = (n: number) => 3 + ((n - x0) / (x1 - x0)) * (w - 6);
  const sy = (p: number) => 3 + ((100 - p) / 100) * (h - 6);

  return (
    <figure className="border border-line bg-panel px-[14px] py-[12px]">
      <ul className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={ariaLabel}>
        {PATHWAYS.map((p) => {
          const pts = series[p];
          const first = pts[0];
          const last = pts.at(-1);
          if (!first || !last) return null;
          const moved = pts.filter((x, i) => i > 0 && x.probability !== pts[i - 1]!.probability).at(-1);
          const d = pts.map((x, i) => `${i ? "L" : "M"}${sx(dayIndex(x.date))},${sy(x.probability)}H${sx(dayIndex(x.date) + 1)}`).join("");
          return (
            <li key={p} className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="inline-block h-2.5 w-2.5" style={{ background: pathwayColor(p) }} aria-hidden="true" />{PATHWAY_SHORT[p]}</span>
              <span className="font-mono text-[12px]">
                <span className="text-[17px] text-fg">{last.probability}%</span>{" "}
                <span className={last.probability === first.probability ? "text-muted" : last.probability > first.probability ? "text-accent" : "text-green"}>
                  {last.probability === first.probability ? `steady since ${dayMonth(first.date)}` : `${last.probability > first.probability ? "▲" : "▼"} from ${first.probability}% · last moved ${dayMonth(moved!.date)}`}
                </span>
              </span>
              <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`${PATHWAY_SHORT[p]}: ${first.probability}% on ${dayMonth(first.date)}, ${last.probability}% on ${dayMonth(last.date)}`}>
                <line x1={3} x2={w - 3} y1={sy(50)} y2={sy(50)} {...gridLine} />
                <line x1={3} x2={w - 3} y1={sy(0)} y2={sy(0)} stroke="var(--rule)" strokeWidth={1} />
                <path d={d} fill="none" stroke={pathwayColor(p)} strokeWidth={2} />
                {pts.map((x) => (
                  <rect key={x.date} x={sx(dayIndex(x.date))} y={0} width={Math.max(sx(dayIndex(x.date) + 1) - sx(dayIndex(x.date)), 0.5)} height={h} fill="transparent">
                    <title>{`${PATHWAY_SHORT[p]}, ${dayMonth(x.date)}: ${x.probability}%`}</title>
                  </rect>
                ))}
              </svg>
            </li>
          );
        })}
      </ul>
      <p className="kicker mt-2">0–100% scale, dashed line at 50% · {dayMonth(dates[0]!)} to {dayMonth(dates.at(-1)!)}</p>
      <details className="kicker mt-2">
        <summary className="cursor-pointer">Data table: {ariaLabel}</summary>
        <div className="mt-1 max-h-72 overflow-auto">
          <Table head={["Date", ...PATHWAYS.map((p) => PATHWAY_SHORT[p])]} rows={[...dates].reverse().map((d) => [d, ...PATHWAYS.map((p) => { const x = series[p].find((y) => y.date === d); return x ? `${x.probability}%` : "–"; })])} />
        </div>
      </details>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------------

/** Serious incidents as dots by date and rung, coloured by pathway. */
export function SeriousTimeline({ incidents, from, to, ariaLabel, height = 130 }: { incidents: Pick<Incident, "id" | "date" | "pathway" | "rung">[]; from: string; to: string; ariaLabel: string; height?: number }) {
  if (!incidents.length) return null;
  const lo = Math.min(2, ...incidents.map((i) => i.rung));
  const hi = Math.max(4, ...incidents.map((i) => i.rung));
  const m = { l: 18, r: 8, t: 10, b: 20 };
  const x0 = dayIndex(from);
  const x1 = dayIndex(to) + 1;
  const sx = (d: string) => m.l + ((dayIndex(d) - x0) / (x1 - x0)) * (W - m.l - m.r);
  const sy = (r: number) => m.t + ((hi + 0.5 - r) / (hi - lo + 1)) * (height - m.t - m.b);
  const base = height - m.b;
  const rungs = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);

  return (
    <Figure
      ariaLabel={ariaLabel}
      legend={<Legend items={PATHWAYS.map((p) => ({ label: PATHWAY_SHORT[p], color: pathwayColor(p) }))} />}
      table={<Table head={["Date", "Incident", "Pathway", "Rung"]} rows={[...incidents].reverse().map((i) => [i.date, i.id, PATHWAY_SHORT[i.pathway], i.rung])} />}
    >
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {rungs.map((r) => (
          <g key={r}>
            <line x1={m.l} x2={W - m.r} y1={sy(r)} y2={sy(r)} {...gridLine} />
            <text x={m.l - 4} y={sy(r) + 3.2} textAnchor="end" {...mono} fill="var(--muted)">{r}</text>
          </g>
        ))}
        <line x1={m.l} x2={W - m.r} y1={base} y2={base} stroke="var(--rule)" strokeWidth={1} />
        {yearStarts(from, to).map((d) => (
          <g key={d}>
            <line x1={sx(d)} x2={sx(d)} y1={base} y2={base + 3} stroke="var(--rule)" strokeWidth={1} />
            <text x={sx(d)} y={height - 5} textAnchor="middle" {...mono} fill="var(--muted)">{d.slice(0, 4)}</text>
          </g>
        ))}
        {incidents.map((i) => (
          <circle key={i.id} cx={sx(i.date)} cy={sy(i.rung)} r={3.4} fill={pathwayColor(i.pathway)} stroke="var(--panel)" strokeWidth={1.4}>
            <title>{`${i.id} · ${shortDate(i.date)} · ${PATHWAY_SHORT[i.pathway]} · rung ${i.rung}`}</title>
          </circle>
        ))}
      </svg>
    </Figure>
  );
}

// ---------------------------------------------------------------------------------------------------

/** One series as bars by period; a missing value shows as a dot on the baseline. */
export function PeriodBars({ bars, color, ariaLabel, describe, height = 140 }: {
  bars: { date: string; label: string; value: number | null }[];
  color: string;
  ariaLabel: string;
  /** The hover text for one bar. */
  describe: (bar: { label: string; value: number | null }) => string;
  height?: number;
}) {
  const values = bars.flatMap((b) => (b.value === null ? [] : [b.value]));
  if (!values.length) return null;
  const m = { l: 28, r: 6, t: 8, b: 20 };
  const max = Math.max(...values, 1);
  const step = max <= 10 ? 5 : max <= 50 ? 10 : max <= 200 ? 50 : 100;
  const top = Math.ceil(max / step) * step;
  const slot = (W - m.l - m.r) / bars.length;
  const bw = Math.max(1.5, Math.min(20, slot * 0.75));
  const sy = (v: number) => m.t + ((top - v) / top) * (height - m.t - m.b);
  const base = sy(0);

  return (
    <Figure ariaLabel={ariaLabel} table={<Table head={["Period", "Value"]} rows={[...bars].reverse().map((b) => [b.label, b.value ?? "–"])} />}>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {[0, top / 2, top].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} {...gridLine} />
            <text x={m.l - 4} y={sy(t) + 3.2} textAnchor="end" {...mono} fill="var(--muted)">{t}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = m.l + i * slot + (slot - bw) / 2;
          return b.value === null ? (
            <circle key={b.date} cx={x + bw / 2} cy={base - 2} r={1.2} fill="var(--muted)"><title>{describe(b)}</title></circle>
          ) : (
            <rect key={b.date} x={x} y={sy(b.value)} width={bw} height={Math.max(base - sy(b.value), 0.5)} fill={color}><title>{describe(b)}</title></rect>
          );
        })}
        <line x1={m.l} x2={W - m.r} y1={base} y2={base} stroke="var(--rule)" strokeWidth={1} />
        <text x={m.l} y={height - 5} {...mono} fill="var(--muted)">{bars[0]!.label}</text>
        <text x={W - m.r} y={height - 5} textAnchor="end" {...mono} fill="var(--muted)">{bars.at(-1)!.label}</text>
      </svg>
    </Figure>
  );
}

// ---------------------------------------------------------------------------------------------------

export type RangeKey = "m3" | "m12" | "all";

/**
 * Three views of one chart behind radio chips. CSS alone switches them (`.range-switch` in globals.css),
 * so the page stays free of client JavaScript; the 12-month view shows where `:has()` is unsupported.
 */
export function RangeSwitch({ options }: { options: { key: RangeKey; label: string; content: ReactNode }[] }) {
  return (
    <div className="range-switch">
      <fieldset className="mb-3 flex flex-wrap items-center gap-2">
        <legend className="kicker float-left mr-2">Range</legend>
        {options.map((o) => (
          <label key={o.key} className="cursor-pointer">
            <input type="radio" name="trend-range" id={`range-${o.key}`} value={o.key} defaultChecked={o.key === "m12"} className="sr-only" />
            <span className="range-chip">{o.label}</span>
          </label>
        ))}
      </fieldset>
      {options.map((o) => <div key={o.key} className={`range-panel range-${o.key}`}>{o.content}</div>)}
    </div>
  );
}
