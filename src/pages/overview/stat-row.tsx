import { Stat } from "7k-design-system/react";

import { listApprovals } from "@/api/approvals";
import { listClusters } from "@/api/clusters";
import { listDrift } from "@/api/fleet";
import { useAsyncResource } from "@/api/hooks";
import { listResources } from "@/api/resources";
import { useTenant } from "@/tenant/tenant-context";

// Stat row at the top of the tenant overview: "is anything on fire?" in one
// glance — clusters, pending approvals, drift, resources.
export function OverviewStatRow() {
  const { tenant } = useTenant();
  const { data: clusters } = useAsyncResource((token) => listClusters(token, tenant), [tenant], {
    refetchIntervalMs: 30_000,
  });
  const { data: approvals } = useAsyncResource(
    (token) => listApprovals(token, tenant, "inbox"),
    [tenant],
    { refetchIntervalMs: 15_000 },
  );
  const { data: drift } = useAsyncResource(
    (token) => listDrift(token, tenant, { status: "open" }),
    [tenant],
    { refetchIntervalMs: 30_000 },
  );
  const { data: resources } = useAsyncResource((token) => listResources(token, tenant), [tenant], {
    refetchIntervalMs: 30_000 },
  );

  const healthyClusters = (clusters ?? []).filter((c) => c.status === "connected").length;
  const totalClusters = clusters?.length ?? 0;
  const pendingApprovals = approvals?.length ?? 0;
  const openDrift = drift?.length ?? 0;
  const totalResources = resources?.length ?? 0;
  const healthyResources = (resources ?? []).filter((r) => r.health === "healthy").length;

  return (
    <div className="stat-row" data-testid="overview-stat-row">
      <Stat value={`${healthyClusters}/${totalClusters}`} label="Clusters healthy" />
      <Stat value={pendingApprovals} label="Pending approvals" accent={pendingApprovals > 0} />
      <Stat value={openDrift} label="Drift" status={openDrift > 0 ? "warning" : undefined} />
      <Stat value={`${healthyResources}/${totalResources}`} label="Resources healthy" />
    </div>
  );
}
