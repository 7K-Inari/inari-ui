import { Link } from "react-router-dom";

import { listApprovals } from "@/api/approvals";
import { listClusters } from "@/api/clusters";
import { listDrift } from "@/api/fleet";
import { useAsyncResource } from "@/api/hooks";
import { listResources } from "@/api/resources";
import { PageHeader } from "@/components/page-header";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { ActivityCard } from "@/pages/overview/activity-card";
import { ClusterHealthCard } from "@/pages/overview/cluster-health-card";
import { DriftCard } from "@/pages/overview/drift-card";
import { PendingApprovalsCard } from "@/pages/overview/pending-approvals-card";
import { QuickActionsCard } from "@/pages/overview/quick-actions-card";
import { ResourceHealthCard } from "@/pages/overview/resource-health-card";
import { OverviewStatRow } from "@/pages/overview/stat-row";

export function OverviewPage() {
  const { tenant } = useTenant();
  // One fetch per resource shared between the stat row and its card — no
  // duplicate polling.
  const clustersState = useAsyncResource((token) => listClusters(token, tenant), [tenant], {
    refetchIntervalMs: 30_000,
  });
  const approvalsState = useAsyncResource(
    (token) => listApprovals(token, tenant, "inbox"),
    [tenant],
    { refetchIntervalMs: 15_000 },
  );
  const driftState = useAsyncResource(
    (token) => listDrift(token, tenant, { status: "open" }),
    [tenant],
    { refetchIntervalMs: 30_000 },
  );
  const resourcesState = useAsyncResource((token) => listResources(token, tenant), [tenant], {
    refetchIntervalMs: 30_000,
  });

  return (
    <div>
      <PageHeader
        breadcrumb="Overview"
        title={<span className="mono-title">{tenant}</span>}
        actions={
          <>
            <Link to={tenantLink(tenant, "catalog")} className="btn btn-secondary">
              Browse catalog
            </Link>
            <Link to={tenantLink(tenant, "clusters/new")} className="btn btn-glow-accent">
              Register cluster
            </Link>
          </>
        }
      />
      <OverviewStatRow
        clusters={clustersState}
        approvals={approvalsState}
        drift={driftState}
        resources={resourcesState}
      />
      <div className="overview-grid">
        <ClusterHealthCard state={clustersState} />
        <ActivityCard />
        <PendingApprovalsCard state={approvalsState} />
        <ResourceHealthCard state={resourcesState} />
        <DriftCard state={driftState} />
        <QuickActionsCard />
      </div>
    </div>
  );
}
