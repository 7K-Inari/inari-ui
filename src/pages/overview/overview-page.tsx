import { useTenant } from "@/tenant/tenant-context";
import { ClusterHealthCard } from "@/pages/overview/cluster-health-card";
import { PendingApprovalsCard } from "@/pages/overview/pending-approvals-card";

export function OverviewPage() {
  const { tenant } = useTenant();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Tenant <span className="font-mono">{tenant}</span>: cluster health and pending
          approvals at a glance.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ClusterHealthCard />
        <PendingApprovalsCard />
      </div>
    </div>
  );
}
