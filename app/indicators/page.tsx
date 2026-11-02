import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/layout/chrome";
import { StatusBadge } from "@/components/ui/badges";
import { loadContent } from "@/lib/content";
import { countryList, shortDate } from "@/lib/format";
import { INDICATOR_TIERS, type IndicatorTier } from "@/lib/vocab";

export const metadata: Metadata = { title: "Warning indicators" };

const TIER_TITLES: Record<IndicatorTier, { title: string; note: string }> = {
  incident: { title: "Incident indicators", note: "What drives the 30-day incident risk." },
  strategic: { title: "Strategic indicators", note: "What would come before deliberate Russian action against NATO." },
  driver: { title: "Driver tripwires", note: "Decisions in the war that would move every pathway." },
};

const ORDER = { active: 0, watch: 1, dormant: 2 } as const;

export default function IndicatorsPage() {
  const { state } = loadContent();
  const active = state.indicators.filter((i) => i.status === "active").length;
  const watch = state.indicators.filter((i) => i.status === "watch").length;
  return (
    <>
      <PageHeader title="Warning indicators">
        {active} active, {watch} on watch, {state.indicators.length - active - watch} dormant
        {state.as_of === "seed" ? " · starting set, not yet assessed" : ` · as of ${shortDate(state.as_of)}`}
      </PageHeader>
      {INDICATOR_TIERS.map((tier) => (
        <Section key={tier} title={TIER_TITLES[tier].title} note={TIER_TITLES[tier].note}>
          <ul className="divide-y divide-line">
            {state.indicators
              .filter((i) => i.tier === tier)
              .sort((a, b) => ORDER[a.status] - ORDER[b.status])
              .map((i) => (
                <li key={i.id} className="py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={i.status} />
                    <span className="font-semibold">{i.name}</span>
                  </div>
                  <p className="mt-0.5 text-muted">{i.description}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {i.countries.length ? `${countryList(i.countries)} · ` : "Europe-wide · "}
                    {i.status} since {shortDate(i.since)}
                  </p>
                  {i.last_evidence ? (
                    <p className="mt-1"><span className="text-xs text-muted">{i.last_evidence_date ? shortDate(i.last_evidence_date) : ""}</span> {i.last_evidence}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        </Section>
      ))}
    </>
  );
}
