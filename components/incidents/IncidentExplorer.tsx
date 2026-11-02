"use client";

import { useMemo, useState } from "react";
import type { Incident } from "@/lib/schema/incident";
import { countryName, PATHWAY_SHORT } from "@/lib/format";
import { ATTRIBUTION, COUNTRIES, PATHWAYS, RUNGS } from "@/lib/vocab";
import { IncidentRow } from "./IncidentRow";

export interface IncidentExplorerProps { incidents: Incident[] }

const field = "border border-line bg-panel px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-fg";

/** Filterable incident list, newest first (SPEC §6). */
export function IncidentExplorer({ incidents }: IncidentExplorerProps) {
  const [pathway, setPathway] = useState("all");
  const [country, setCountry] = useState("all");
  const [minRung, setMinRung] = useState(1);
  const [minAttribution, setMinAttribution] = useState(1);
  const [query, setQuery] = useState("");

  const countries = useMemo(() => COUNTRIES.filter((c) => incidents.some((i) => (i.affected as string[]).includes(c))), [incidents]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents
      .filter((i) => pathway === "all" || i.pathway === pathway)
      .filter((i) => country === "all" || (i.affected as string[]).includes(country))
      .filter((i) => i.rung >= minRung && i.attribution >= minAttribution)
      .filter((i) => !q || `${i.summary} ${i.location ?? ""} ${i.attribution_note ?? ""} ${i.id}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [incidents, pathway, country, minRung, minAttribution, query]);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="ie-pathway">Pathway</label>
        <select id="ie-pathway" className={field} value={pathway} onChange={(e) => setPathway(e.target.value)}>
          <option value="all">All pathways</option>
          {PATHWAYS.map((p) => <option key={p} value={p}>{PATHWAY_SHORT[p]}</option>)}
        </select>
        <label className="sr-only" htmlFor="ie-country">Country</label>
        <select id="ie-country" className={field} value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="all">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
        </select>
        <label className="sr-only" htmlFor="ie-rung">Minimum rung</label>
        <select id="ie-rung" className={field} value={minRung} onChange={(e) => setMinRung(Number(e.target.value))}>
          {RUNGS.filter((r) => r.rung >= 1).map((r) => <option key={r.rung} value={r.rung}>Rung {r.rung}+</option>)}
        </select>
        <label className="sr-only" htmlFor="ie-attr">Minimum attribution</label>
        <select id="ie-attr" className={field} value={minAttribution} onChange={(e) => setMinAttribution(Number(e.target.value))}>
          {([1, 2, 3, 4] as const).map((l) => <option key={l} value={l}>{ATTRIBUTION[l].label}{l < 4 ? " or higher" : ""}</option>)}
        </select>
        <label className="sr-only" htmlFor="ie-q">Search</label>
        <input id="ie-q" className={`${field} min-w-0 flex-1`} type="search" placeholder="Search summaries" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <p className="kicker mt-3" aria-live="polite">{shown.length} of {incidents.length} incidents</p>
      <ul className="divide-y divide-line">
        {shown.map((i) => <IncidentRow key={i.id} incident={i} />)}
      </ul>
    </div>
  );
}
