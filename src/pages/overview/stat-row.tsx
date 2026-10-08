import { Stat } from "7k-design-system/react";

import type { ApprovalRequest } from "@/api/approvals";
import type { DriftEntry } from "@/api/fleet";
import type { AsyncState } from "@/api/hooks";
import type { ClusterSummary, ResourceInstanceSummary } from "@/api/types";

interface OverviewStatRowProps {
  clusters: AsyncState<ClusterSummary[]>;
  approvals: AsyncState<ApprovalRequest[]>;
  drift: AsyncState<DriftEntry[]>;
  resources: AsyncState<ResourceInstanceSummary[]>;
}

// Stat row at the top of the tenant overview: "is anything on fire?" in one
// glance — clusters, pending approvals, drift, resources. The page owns the
// fetches and shares the state with the cards (no duplicate polling).
export function OverviewStatRow(props: OverviewStatRowProps) {
  const { data: clusters } = props.clusters;
  const { data: approvals } = props.approvals;
  const { data: drift } = props.drift;
  const { data: resources } = props.resources;

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
