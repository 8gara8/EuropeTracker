import type { Incident } from "@/lib/schema/incident";
import { countryList, incidentTypeLabel, pathwayLabel, shortDate } from "@/lib/format";
import { AttributionBadge, RungBadge, Tag } from "@/components/ui/badges";
import { EvidenceLinks } from "@/components/brief/sources";

export function IncidentRow({ incident: x }: { incident: Incident }) {
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="tabular text-muted">{shortDate(x.date)}{x.date_precision === "month" ? " (month)" : ""}</span>
        <span className="font-semibold">{countryList(x.affected)}</span>
        {x.location ? <span className="text-muted">{x.location}</span> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <RungBadge rung={x.rung} />
        <AttributionBadge level={x.attribution} />
        <Tag>{pathwayLabel(x.pathway)}</Tag>
        <Tag>{incidentTypeLabel(x.pathway, x.type)}</Tag>
        {x.serious ? <Tag>serious</Tag> : null}
        {x.casualties.killed || x.casualties.injured ? <Tag>{x.casualties.killed} killed, {x.casualties.injured} injured</Tag> : null}
      </div>
      <p className="mt-1 text-sm">{x.summary}</p>
      {x.attribution_note ? <p className="text-xs text-muted">{x.attribution_note}</p> : null}
      <EvidenceLinks sources={x.sources} />
      <span className="ml-2 text-xs text-muted">{x.id}</span>
    </li>
  );
}
