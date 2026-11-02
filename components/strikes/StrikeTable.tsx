import type { Strike } from "@/lib/schema/strike";
import { shortDate } from "@/lib/format";
import { Pill, VerificationBadge } from "@/components/ui/badges";
import { EvidenceLinks } from "@/components/brief/sources";

/** One deep strike: date and verification on the left, target and write-up on the right. */
export function StrikeRow({ strike: s }: { strike: Strike }) {
  return (
    <li className="grid gap-x-5 gap-y-2 border-b border-line py-3 pl-3 md:grid-cols-[150px_1fr]" style={{ borderLeft: `3px solid ${s.verification >= 4 ? "var(--green)" : s.verification === 3 ? "var(--amber)" : "var(--rule-soft)"}` }}>
      <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start md:gap-1.5">
        <span className="tabular text-[12px] text-fg">{shortDate(s.date)}</span>
        <VerificationBadge level={s.verification} />
        {s.western_weapon ? <Pill tone="mix">Western weapon</Pill> : null}
        {s.occupied_territory ? <Pill>Occupied territory</Pill> : null}
      </div>
      <div className="min-w-0">
        <p className="kicker normal-case tracking-[0.06em]">
          {s.target_type.replace(/_/g, " ")} · {s.weapon_detail ? `${s.weapon}: ${s.weapon_detail}` : s.weapon} · {s.id}
        </p>
        <h3 className="display mt-0.5 text-[16.5px] leading-snug">
          {s.target_name}<span className="font-normal text-soft"> · {s.region}{s.distance_km !== null ? `, about ${s.distance_km} km from the front` : ""}</span>
        </h3>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-soft">{s.summary}</p>
        {s.damage ? <p className="mt-1 text-[13px]"><span className="kicker text-fg">Damage →</span> <span className="text-soft">{s.damage}</span></p> : null}
        {s.effect ? <p className="mt-1 text-[13px]"><span className="kicker text-fg">Effect →</span> <span className="text-soft">{s.effect}</span></p> : null}
        <div className="mt-1"><EvidenceLinks sources={s.sources} /></div>
      </div>
    </li>
  );
}

/** Strikes, newest first. */
export function StrikeTable({ strikes }: { strikes: Strike[] }) {
  const rows = [...strikes].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return <ul className="border-t border-line">{rows.map((s) => <StrikeRow key={s.id} strike={s} />)}</ul>;
}
