import type { Strike } from "@/lib/schema/strike";
import { shortDate } from "@/lib/format";
import { Tag, VerificationBadge } from "@/components/ui/badges";
import { EvidenceLinks } from "@/components/brief/sources";

export function StrikeRow({ strike: s }: { strike: Strike }) {
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="tabular text-muted">{shortDate(s.date)}</span>
        <span className="font-semibold">{s.target_name}</span>
        <span className="text-muted">{s.region}{s.distance_km !== null ? ` · about ${s.distance_km} km from the front` : ""}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <VerificationBadge level={s.verification} />
        <Tag>{s.target_type.replace(/_/g, " ")}</Tag>
        <Tag>{s.weapon_detail ? `${s.weapon}: ${s.weapon_detail}` : s.weapon}</Tag>
        {s.occupied_territory ? <Tag>occupied territory</Tag> : null}
        {s.western_weapon ? <Tag>Western weapon</Tag> : null}
      </div>
      <p className="mt-1 text-sm">{s.summary}</p>
      {s.damage ? <p className="text-xs"><span className="font-semibold">Damage:</span> {s.damage}</p> : null}
      {s.effect ? <p className="text-xs"><span className="font-semibold">Effect:</span> {s.effect}</p> : null}
      <EvidenceLinks sources={s.sources} />
      <span className="ml-2 text-xs text-muted">{s.id}</span>
    </li>
  );
}

/** Strikes, newest first. */
export function StrikeTable({ strikes }: { strikes: Strike[] }) {
  const rows = [...strikes].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return <ul className="divide-y divide-line">{rows.map((s) => <StrikeRow key={s.id} strike={s} />)}</ul>;
}
