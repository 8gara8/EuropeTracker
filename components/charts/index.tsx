import type { ReactNode } from "react";
import { dayMonth, monthLabel, PATHWAY_SHORT } from "@/lib/format";
import { PATHWAYS, PROBABILITY_TERMS, type ProbabilityTerm } from "@/lib/vocab";

// Server-rendered SVG charts (SPEC §6). No client JavaScript: each mark carries a <title> for the
// hover tooltip, and every chart has a data table in a <details> beneath it. The viewBox is narrow
// (400 units) and the figure is capped at 560px, so text stays readable from 375px phones to desktops.

const W = 400;
const FONT = 9.5;

function Figure({ ariaLabel, children, legend, table }: { ariaLabel: string; children: ReactNode; legend?: ReactNode; table: ReactNode }) {
  return (
    <figure className="max-w-[640px] border border-line bg-panel px-[14px] py-[12px]">
      {children}
      {legend}
      <details className="kicker mt-2">
        <summary className="cursor-pointer">Data table: {ariaLabel}</summary>
        <div className="mt-1 max-h-72 overflow-auto">{table}</div>
      </details>
    </figure>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="tabular w-full text-xs">
      <thead><tr>{head.map((h) => <th key={h} className="border-b border-line py-0.5 pr-2 text-left">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="py-0.5 pr-2">{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const dayIndex = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

// ---------------------------------------------------------------------------------------------------

export interface LineChartProps {
  series: { name: string; points: { x: string; y: number }[]; color?: string }[];
  yMin?: number;
  yMax?: number;
  yTicks?: number[];
  yLabel?: (y: number) => string;
  step?: boolean;
  height?: number;
  ariaLabel: string;
}

export function LineChart({ series, yMin = 0, yMax, yTicks, yLabel = String, step = false, height = 160, ariaLabel }: LineChartProps) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return null;
  const top = yMax ?? Math.max(...all.map((p) => p.y), 1);
  const ticks = yTicks ?? [yMin, (yMin + top) / 2, top];
  const m = { l: 34, r: 10, t: 8, b: 20 };
  const xs = all.map((p) => dayIndex(p.x));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const sx = (d: string) => (x1 === x0 ? (m.l + W - m.r) / 2 : m.l + ((dayIndex(d) - x0) / (x1 - x0)) * (W - m.l - m.r));
  const sy = (y: number) => height - m.b - ((y - yMin) / (top - yMin || 1)) * (height - m.t - m.b);
  const first = all.reduce((a, p) => (p.x < a ? p.x : a), all[0]!.x);
  const last = all.reduce((a, p) => (p.x > a ? p.x : a), all[0]!.x);

  const path = (pts: { x: string; y: number }[]) => pts.map((p, i) => {
    if (i === 0) return `M${sx(p.x)},${sy(p.y)}`;
    return step ? `H${sx(p.x)}V${sy(p.y)}` : `L${sx(p.x)},${sy(p.y)}`;
  }).join("");

  return (
    <Figure
      ariaLabel={ariaLabel}
      legend={series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.name, color: s.color ?? `var(--pw-${PATHWAYS[i % PATHWAYS.length]})` }))} /> : null}
      table={<Table head={["Date", ...series.map((s) => s.name)]} rows={[...new Set(all.map((p) => p.x))].sort().map((x) => [x, ...series.map((s) => { const p = s.points.find((q) => q.x === x); return p ? yLabel(p.y) : "–"; })])} />}
    >
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} stroke="var(--border)" strokeWidth={1} strokeDasharray="1 3" />
            <text x={m.l - 4} y={sy(t) + 3.5} textAnchor="end" fontSize={FONT} fontFamily="var(--font-mono)" fill="var(--muted)">{yLabel(t)}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const color = s.color ?? (series.length > 1 ? `var(--pw-${PATHWAYS[i % PATHWAYS.length]})` : "var(--accent)");
          return (
            <g key={s.name}>
              <path d={path(s.points)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p) => (
                <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={color} stroke="var(--bg)" strokeWidth={1.5}>
                  <title>{`${s.name}, ${dayMonth(p.x)}: ${yLabel(p.y)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        <text x={m.l} y={height - 5} fontSize={FONT} fontFamily="var(--font-mono)" fill="var(--muted)">{dayMonth(first)}</text>
        <text x={W - m.r} y={height - 5} fontSize={FONT} fontFamily="var(--font-mono)" fill="var(--muted)" textAnchor="end">{dayMonth(last)}</text>
      </svg>
    </Figure>
  );
}

// ---------------------------------------------------------------------------------------------------

export interface MonthlyBarsProps {
  months: { month: string; counts: Partial<Record<string, number>> }[];
  /** Stack order and colors; defaults to the seven pathways. */
  series?: { key: string; label: string; color: string }[];
  height?: number;
  ariaLabel: string;
}

const PATHWAY_SERIES = PATHWAYS.map((p) => ({ key: p as string, label: PATHWAY_SHORT[p], color: `var(--pw-${p})` }));

/** A bar whose top corners are rounded (the data end) and whose base is square. */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function MonthlyBars({ months, series = PATHWAY_SERIES, height = 170, ariaLabel }: MonthlyBarsProps) {
  if (!months.length) return null;
  const m = { l: 26, r: 6, t: 8, b: 20 };
  const totals = months.map((mo) => series.reduce((s, x) => s + (mo.counts[x.key] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const niceMax = max <= 5 ? max : Math.ceil(max / 5) * 5;
  const slot = (W - m.l - m.r) / months.length;
  const bw = Math.max(1.5, Math.min(24, slot * 0.72));
  const sy = (v: number) => (v / niceMax) * (height - m.t - m.b);
  const base = height - m.b;
  const GAP = 2;

  return (
    <Figure
      ariaLabel={ariaLabel}
      legend={series.length > 1 ? <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} /> : null}
      table={<Table head={["Month", ...series.map((s) => s.label), "Total"]} rows={months.map((mo, i) => [mo.month, ...series.map((s) => mo.counts[s.key] ?? 0), totals[i]!])} />}
    >
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {[0, niceMax / 2, niceMax].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={base - sy(t)} y2={base - sy(t)} stroke="var(--border)" strokeWidth={1} strokeDasharray="1 3" />
            <text x={m.l - 4} y={base - sy(t) + 3.5} textAnchor="end" fontSize={FONT} fontFamily="var(--font-mono)" fill="var(--muted)">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        ))}
        {months.map((mo, i) => {
          const x = m.l + i * slot + (slot - bw) / 2;
          const present = series.filter((s) => (mo.counts[s.key] ?? 0) > 0);
          let y = base;
          return (
            <g key={mo.month}>
              {present.map((s, k) => {
                const h = sy(mo.counts[s.key]!);
                const isTop = k === present.length - 1;
                const segH = Math.max(h - (k > 0 ? GAP : 0), 0.5);
                y -= h;
                const d = isTop ? topRounded(x, y + (k > 0 ? GAP : 0), bw, segH, 4) : `M${x},${y + (k > 0 ? GAP : 0)}h${bw}v${segH}h${-bw}Z`;
                return (
                  <path key={s.key} d={d} fill={s.color}>
                    <title>{`${monthLabel(mo.month)} · ${s.label}: ${mo.counts[s.key]}`}</title>
                  </path>
                );
              })}
            </g>
          );
        })}
        {months.map((mo, i) => (mo.month.endsWith("-01") || i === 0 ? (
          <text key={mo.month} x={m.l + i * slot} y={height - 5} fontSize={FONT} fontFamily="var(--font-mono)" fill="var(--muted)">{mo.month.slice(0, 4)}</text>
        ) : null))}
      </svg>
    </Figure>
  );
}

// ---------------------------------------------------------------------------------------------------

export interface HeatGridProps {
  rows: { key: string; label: string }[];
  columns: string[];                 // dates
  cells: Record<string, Record<string, { term: ProbabilityTerm; title: string } | null>>; // rowKey → col → cell
  ariaLabel: string;
}

export function HeatGrid({ rows, columns, cells, ariaLabel }: HeatGridProps) {
  if (!columns.length) return null;
  const labelW = 140;
  const rowH = 18;
  const GAP = 2;
  const cw = Math.min(26, (W - labelW) / columns.length);
  const height = rows.length * rowH + 18;
  const terms = Object.keys(PROBABILITY_TERMS) as ProbabilityTerm[];

  return (
    <Figure
      ariaLabel={ariaLabel}
      legend={<Legend items={terms.map((t) => ({ label: PROBABILITY_TERMS[t].label, color: `var(--p-${t})` }))} />}
      table={<Table head={["Date", ...rows.map((r) => r.label)]} rows={columns.map((c) => [c, ...rows.map((r) => cells[r.key]?.[c]?.title ?? "–")])} />}
    >
      <svg viewBox={`0 0 ${labelW + cw * columns.length} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {rows.map((r, i) => (
          <g key={r.key}>
            <text x={labelW - 6} y={i * rowH + rowH / 2 + 4} textAnchor="end" fontSize={FONT} fontFamily="var(--font-mono)" fill="var(--fg)">{r.label}</text>
            {columns.map((c, j) => {
              const cell = cells[r.key]?.[c];
              return (
                <rect key={c} x={labelW + j * cw} y={i * rowH} width={cw - GAP} height={rowH - GAP} rx={2}
                  fill={cell ? `var(--p-${cell.term})` : "transparent"} stroke="var(--border)" strokeWidth={cell ? 0.75 : 1}>
                  <title>{cell ? `${r.label}, ${dayMonth(c)}: ${cell.title}` : `${r.label}, ${dayMonth(c)}: no brief`}</title>
                </rect>
              );
            })}
          </g>
        ))}
        <text x={labelW} y={height - 4} fontSize={FONT} fontFamily="var(--font-mono)" fill="var(--muted)">{dayMonth(columns[0]!)}</text>
        <text x={labelW + cw * columns.length - GAP} y={height - 4} fontSize={FONT} fontFamily="var(--font-mono)" fill="var(--muted)" textAnchor="end">{dayMonth(columns.at(-1)!)}</text>
      </svg>
    </Figure>
  );
}

