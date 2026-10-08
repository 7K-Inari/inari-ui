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
      href={`${tenantLink(tenant, "fleet")}?tab=drift`}
      state={state}
      isEmpty={(events) => events.length === 0}
      empty={<p>No open drift detected</p>}
    >
      {(events: DriftEntry[]) => {
        const latest = [...events]
          .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
          .slice(0, LATEST_EVENTS);
        return (
          <div className="overview-card-stack">
            <p className="stat-value">{events.length}</p>
            <ul className="list">
              {latest.map((e) => (
                <li key={e.id} className="list-item">
                  <div className="overview-count-row">
                    <span className="overview-approval-title">
                      {e.kind}/{e.resourceRef ?? e.clusterId}
                    </span>
                    <span className="mono-caption">{formatRelative(e.detectedAt)}</span>
                  </div>
                  {e.detail && <p className="mono-caption">{e.detail}</p>}
                </li>
              ))}
            </ul>
          </div>
        );
      }}
    </OverviewCard>
  );
}
