import { Link } from "react-router-dom";

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
      <OverviewStatRow />
      <div className="overview-grid">
        <ClusterHealthCard />
        <ActivityCard />
        <PendingApprovalsCard />
        <ResourceHealthCard />
        <DriftCard />
        <QuickActionsCard />
      </div>
    </div>
  );
}
