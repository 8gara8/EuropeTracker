// Forecast report (SPEC §7.9): open forecasts, resolved ones with their Brier scores, and the means.
// Scoring itself happens in publish through aggregate.brier().
//   tsx scripts/score-forecasts.ts --report

import { brier, brierSummary } from "../lib/aggregate";
import { contentDir, loadContent } from "../lib/content";

const { forecasts } = loadContent(contentDir());
const open = forecasts.filter((f) => f.status === "open");
const closed = forecasts.filter((f) => f.status !== "open");

console.log(`Open (${open.length})`);
for (const f of open) {
  const p = f.updates.at(-1)?.probability ?? f.probability;
  console.log(`  ${f.id}  ${String(p).padStart(2)}%  base ${String(f.base_rate).padStart(3)}%  by ${f.resolves_by}  ${f.question}`);
}
console.log(`\nResolved (${closed.length})`);
for (const f of closed) {
  const b = brier(f);
  console.log(`  ${f.id}  ${f.status.replace("resolved_", "").padEnd(8)}  Brier ${b.brier?.toFixed(3) ?? "  –  "}  base ${b.brier_base?.toFixed(3) ?? "  –  "}  ${f.question}`);
}
const s = brierSummary(forecasts);
console.log(`\nScored: ${s.n} · mean Brier ${s.mean_brier ?? "–"} · base-rate Brier ${s.mean_brier_base ?? "–"}`);
