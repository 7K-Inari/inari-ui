import { Link } from "react-router-dom";

import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import type { ClusterStatus, ClusterSummary } from "@/api/types";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { ClusterStatusBadge } from "@/pages/clusters/status-badge";
import { OverviewCard } from "@/pages/overview/overview-card";

const STATUS_ORDER: ClusterStatus[] = ["connected", "degraded", "pending", "disconnected"];

// Shared with the all-tenants home (org-grouped mode): per-status cluster
// counts in a stable order.
export function ClusterStatusCounts({ clusters }: { clusters: ClusterSummary[] }) {
  const counts = new Map<ClusterStatus, number>();
  for (const c of clusters) {
    counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  }
  return (
    <ul className="space-y-1">
      {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
        <li key={s} className="flex items-center justify-between text-sm">
          <ClusterStatusBadge status={s} />
          <span className="tabular-nums">{counts.get(s)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ClusterHealthCard() {
  const { tenant } = useTenant();
  const state = useAsyncResource((token) => listClusters(token, tenant), [tenant], {
    refetchIntervalMs: 30_000,
  });

  return (
    <OverviewCard
      title="Cluster health"
      testId="card-cluster-health"
      href={tenantLink(tenant, "clusters")}
      state={state}
      isEmpty={(clusters) => clusters.length === 0}
      empty={
        <p>
          No clusters registered yet.{" "}
          <Link to={tenantLink(tenant, "clusters/new")} className="text-primary hover:underline">
            Register your first cluster
          </Link>
        </p>
      }
    >
      {(clusters: ClusterSummary[]) => (
        <div className="space-y-3">
          <p className="text-3xl font-semibold">{clusters.length}</p>
          <ClusterStatusCounts clusters={clusters} />
        </div>
      )}
    </OverviewCard>
  );
}
