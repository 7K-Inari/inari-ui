import { useAsyncResource } from "@/api/hooks";
import { listTenants } from "@/api/tenants";
import { AllTenantsActivitySection } from "@/pages/overview/all-tenants-activity";
import {
  ALL_TENANTS_POLL_MS,
  AllTenantsApprovalsSection,
} from "@/pages/overview/all-tenants-approvals";
import { AllTenantsClusterRollup } from "@/pages/overview/all-tenants-clusters";
import { TenantStrip } from "@/pages/overview/tenant-strip";

// Global home for multi-org users (plan §8.1): org strip with recents, then
// bounded fan-out sections (approvals, cluster health, activity) at a slower
// 60s poll.
export function AllTenantsHome() {
  const tenantsState = useAsyncResource((token) => listTenants(token), [], {
    refetchIntervalMs: ALL_TENANTS_POLL_MS,
  });

  const tenants = tenantsState.data ?? [];
  const orgs = tenants.map((t) => t.slug);
  const orgNames = new Map(tenants.map((t) => [t.slug, t.displayName]));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">All tenants</h1>
        <p className="text-sm text-muted-foreground">
          Pending approvals and cluster health across every organization you belong to.
        </p>
      </div>
      <TenantStrip state={tenantsState} />
      {tenants.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AllTenantsApprovalsSection orgs={orgs} orgNames={orgNames} />
          <AllTenantsClusterRollup orgs={orgs} orgNames={orgNames} />
          <AllTenantsActivitySection orgs={orgs} orgNames={orgNames} />
        </div>
      )}
    </div>
  );
}
