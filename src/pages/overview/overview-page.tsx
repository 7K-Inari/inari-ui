import { useTenant } from "@/tenant/tenant-context";
import { ClusterHealthCard } from "@/pages/overview/cluster-health-card";
import { DriftCard } from "@/pages/overview/drift-card";
import { PendingApprovalsCard } from "@/pages/overview/pending-approvals-card";
import { ResourceHealthCard } from "@/pages/overview/resource-health-card";

export function OverviewPage() {
  const { tenant } = useTenant();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Tenant <span className="font-mono">{tenant}</span>: cluster health, resources, pending
          approvals and drift at a glance.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ClusterHealthCard />
        <PendingApprovalsCard />
        <ResourceHealthCard />
        <DriftCard />
      </div>
    </div>
  );
}
