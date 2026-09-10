import { Link } from "react-router-dom";

import { useAsyncResource } from "@/api/hooks";
import { listResources } from "@/api/resources";
import type { ResourceHealth, ResourceInstanceSummary } from "@/api/types";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { OverviewCard } from "@/pages/overview/overview-card";
import { HealthBadge } from "@/pages/resources/resource-list";

const HEALTH_ORDER: ResourceHealth[] = ["healthy", "progressing", "degraded", "unknown"];

export function ResourceHealthCard() {
  const { tenant } = useTenant();
  const state = useAsyncResource((token) => listResources(token, tenant), [tenant], {
    refetchIntervalMs: 30_000,
  });

  return (
    <OverviewCard
      title="Resource health"
      testId="card-resource-health"
      href={tenantLink(tenant, "deploys")}
      state={state}
      isEmpty={(instances) => instances.length === 0}
      empty={
        <p>
          No resources deployed yet.{" "}
          <Link to={tenantLink(tenant, "catalog")} className="text-primary hover:underline">
            Browse the catalog
          </Link>
        </p>
      }
    >
      {(instances: ResourceInstanceSummary[]) => {
        const counts = new Map<ResourceHealth, number>();
        let upgrades = 0;
        for (const i of instances) {
          counts.set(i.health, (counts.get(i.health) ?? 0) + 1);
          if (i.updateAvailable) upgrades += 1;
        }
        return (
          <div className="space-y-3">
            <p className="text-3xl font-semibold">{instances.length}</p>
            <ul className="space-y-1">
              {HEALTH_ORDER.filter((h) => counts.get(h)).map((h) => (
                <li key={h} className="flex items-center justify-between text-sm">
                  <HealthBadge health={h} />
                  <span className="tabular-nums">{counts.get(h)}</span>
                </li>
              ))}
            </ul>
            {upgrades > 0 && (
              <Link
                to={tenantLink(tenant, "deploys")}
                className="block text-sm text-primary hover:underline"
              >
                {upgrades} upgrade{upgrades === 1 ? "" : "s"} available
              </Link>
            )}
          </div>
        );
      }}
    </OverviewCard>
  );
}
