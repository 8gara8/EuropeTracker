import type { IncidentUpdate, StrikeUpdate } from "@/lib/schema/draft-brief";
import type { Incident } from "@/lib/schema/incident";
import type { Indicator } from "@/lib/schema/state";
import type { Strike } from "@/lib/schema/strike";
import { countryList, shortDate } from "@/lib/format";
import { ATTRIBUTION, VERIFICATION } from "@/lib/vocab";
import { StatusBadge, Tag } from "@/components/ui/badges";
import { EvidenceLinks, SourceRefs, type SourceIndex } from "./sources";

function incidentChanges(u: IncidentUpdate): string[] {
  const c = u.changes;
  const out: string[] = [];
  if (c.attribution !== null) out.push(`attribution → ${ATTRIBUTION[c.attribution].label} (${c.attribution}/4)`);
  if (c.rung !== null) out.push(`rung → ${c.rung}`);
  if (c.serious !== null) out.push(c.serious ? "now serious" : "no longer serious");
  if (c.casualties !== null) out.push(`casualties → ${c.casualties.killed} killed, ${c.casualties.injured} injured`);
  if (c.disruption_hours !== null) out.push(`disruption → ${c.disruption_hours} h`);
  if (c.summary !== null) out.push("summary revised");
  return out;
}

export function IncidentUpdates({ updates, incidentsById }: { updates: IncidentUpdate[]; incidentsById: Record<string, Incident> }) {
  if (!updates.length) return null;
  return (
    <div className="mt-3">
      <h3 className="kicker mt-5 mb-1 text-fg">Updates to earlier incidents</h3>
      <ul className="text-[13.5px]">
        {updates.map((u) => {
          const rec = incidentsById[u.id];
          return (
            <li key={u.id} className="border-b border-line py-2 text-soft">
              <span className="font-semibold text-fg">{u.id}</span>
              {rec ? <span className="text-muted"> ({shortDate(rec.date)}, {countryList(rec.affected)})</span> : null}: {incidentChanges(u).join("; ")}. {u.reason}{" "}
              <EvidenceLinks sources={u.add_sources} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function strikeChanges(u: StrikeUpdate): string[] {
  const c = u.changes;
  const out: string[] = [];
  if (c.verification !== null) out.push(`verification → ${VERIFICATION[c.verification].label} (${c.verification}/5)`);
  if (c.damage !== null) out.push(`damage: ${c.damage}`);
  if (c.effect !== null) out.push(`effect: ${c.effect}`);
  if (c.weapon_detail !== null) out.push(`weapon: ${c.weapon_detail}`);
  if (c.western_weapon !== null) out.push(c.western_weapon ? "Western weapon" : "not a Western weapon");
  if (c.summary !== null) out.push("summary revised");
  return out;
}

export function StrikeUpdates({ updates, strikesById }: { updates: StrikeUpdate[]; strikesById: Record<string, Strike> }) {
  if (!updates.length) return null;
  return (
    <div className="mt-3">
      <h3 className="kicker mt-5 mb-1 text-fg">Updates to earlier strikes</h3>
      <ul className="text-[13.5px]">
        {updates.map((u) => {
          const rec = strikesById[u.id];
          return (
            <li key={u.id} className="border-b border-line py-2 text-soft">
              <span className="font-semibold text-fg">{rec ? rec.target_name : u.id}</span>
              {rec ? <span className="text-muted"> ({shortDate(rec.date)})</span> : null}: {strikeChanges(u).join("; ")}. {u.reason}{" "}
              <EvidenceLinks sources={u.add_sources} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function IndicatorChanges({ changes, added, indicatorsById, index }: {
  changes: { id: string; to: "dormant" | "watch" | "active"; evidence: string; source_ids: string[] }[];
  added: { id: string; name: string; status: "dormant" | "watch" | "active"; evidence: string; source_ids: string[] }[];
  indicatorsById: Record<string, Indicator>;
  index: SourceIndex;
}) {
  const rows = [
    ...changes.map((c) => ({ key: c.id, name: indicatorsById[c.id]?.name ?? c.id, status: c.to, evidence: c.evidence, ids: c.source_ids, isNew: false })),
    ...added.map((n) => ({ key: n.id, name: n.name, status: n.status, evidence: n.evidence, ids: n.source_ids, isNew: true })),
  ];
  return (
    <ul className="text-[13.5px]">
      {rows.map((r) => (
        <li key={r.key} className="border-b border-line py-2">
          <span className="font-semibold">{r.name}</span> <StatusBadge status={r.status} />
          {r.isNew ? <> <Tag>new indicator</Tag></> : null}
          <span className="mt-0.5 block text-soft">{r.evidence} <SourceRefs ids={r.ids} index={index} /></span>
        </li>
      ))}
    </ul>
  );
}
