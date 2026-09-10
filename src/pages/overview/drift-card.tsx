import { listDrift } from "@/api/fleet";
import type { DriftEntry } from "@/api/fleet";
import { useAsyncResource } from "@/api/hooks";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { OverviewCard } from "@/pages/overview/overview-card";

const LATEST_EVENTS = 3;

export function DriftCard() {
  const { tenant } = useTenant();
  const state = useAsyncResource(
    (token) => listDrift(token, tenant, { status: "open" }),
    [tenant],
    { refetchIntervalMs: 30_000 },
  );

  return (
    <OverviewCard
      title="Drift"
      testId="card-drift"
      href={tenantLink(tenant, "fleet")}
      state={state}
      isEmpty={(events) => events.length === 0}
      empty={<p>No open drift detected</p>}
    >
      {(events: DriftEntry[]) => {
        const latest = [...events]
          .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
          .slice(0, LATEST_EVENTS);
        return (
          <div className="space-y-3">
            <p className="text-3xl font-semibold">{events.length}</p>
            <ul className="space-y-2">
              {latest.map((e) => (
                <li key={e.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {e.kind}/{e.resourceRef ?? e.clusterId}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatRelative(e.detectedAt)}
                    </span>
                  </div>
                  {e.detail && <p className="truncate text-muted-foreground">{e.detail}</p>}
                </li>
              ))}
            </ul>
          </div>
        );
      }}
    </OverviewCard>
  );
}
