import type { Incident } from "@/lib/schema/incident";
import { countryList, incidentTypeLabel, pathwayLabel, shortDate } from "@/lib/format";
import { AttributionBadge, Pill, RungBadge } from "@/components/ui/badges";
import { EvidenceLinks } from "@/components/brief/sources";

/** One incident: date and grades on the left, place and write-up on the right, a rung-coloured edge. */
export function IncidentRow({ incident: x }: { incident: Incident }) {
  return (
    <li className="grid gap-x-5 gap-y-2 border-b border-line py-3 pl-3 md:grid-cols-[150px_1fr]" style={{ borderLeft: `3px solid var(--rung-${x.rung})` }}>
      <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start md:gap-1.5">
        <span className="tabular text-[12px] text-fg">{shortDate(x.date)}{x.date_precision === "month" ? " (month)" : ""}</span>
        <RungBadge rung={x.rung} />
        <AttributionBadge level={x.attribution} />
        {x.serious ? <Pill tone="esc">Serious</Pill> : null}
      </div>
      <div className="min-w-0">
        <p className="kicker normal-case tracking-[0.06em]">{pathwayLabel(x.pathway)} · {incidentTypeLabel(x.pathway, x.type)} · {x.id}</p>
        <h3 className="display mt-0.5 text-[16.5px] leading-snug">{countryList(x.affected)}{x.location ? <span className="font-normal text-soft"> · {x.location}</span> : null}</h3>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-soft">{x.summary}</p>
        {x.casualties.killed || x.casualties.injured ? <p className="kicker mt-1 text-accent">{x.casualties.killed} killed · {x.casualties.injured} injured</p> : null}
        {x.attribution_note ? <p className="mt-1 text-[12.5px] text-muted">{x.attribution_note}</p> : null}
        <div className="mt-1"><EvidenceLinks sources={x.sources} /></div>
      </div>
    </li>
  );
}
