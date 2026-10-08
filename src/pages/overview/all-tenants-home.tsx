import { Stat } from "7k-design-system/react";

import { listApprovalsInbox } from "@/api/approvals";
import { useAsyncResource } from "@/api/hooks";
import { listTenants } from "@/api/tenants";
import { PageHeader } from "@/components/page-header";
import { AllTenantsActivitySection } from "@/pages/overview/all-tenants-activity";
import {
  ALL_TENANTS_POLL_MS,
  AllTenantsApprovalsSection,
} from "@/pages/overview/all-tenants-approvals";
import { AllTenantsClusterRollup } from "@/pages/overview/all-tenants-clusters";
import { TenantStrip } from "@/pages/overview/tenant-strip";

// Global home for multi-org users (plan §8.1): aggregate "what needs me" stat
// row, org rows with recents, then bounded fan-out sections (approvals,
// cluster health, activity) at a slower 60s poll.
export function AllTenantsHome() {
  const tenantsState = useAsyncResource((token) => listTenants(token), [], {
    refetchIntervalMs: ALL_TENANTS_POLL_MS,
  });
  const inboxState = useAsyncResource((token) => listApprovalsInbox(token), [], {
    refetchIntervalMs: ALL_TENANTS_POLL_MS,
  });
  const inbox = inboxState.data;

  const tenants = tenantsState.data ?? [];
  const orgs = tenants.map((t) => t.slug);
  const orgNames = new Map(tenants.map((t) => [t.slug, t.displayName]));
  const pending = inbox?.length ?? 0;

  return (
    <div>
      <PageHeader breadcrumb="Overview / All tenants" title="All tenants" />
      <div className="stat-row" data-testid="all-tenants-stat-row">
        <Stat value={tenants.length} label="Tenants" />
        <Stat value={pending} label="Pending approvals" accent={pending > 0} />
      </div>
      <TenantStrip state={tenantsState} />
      {tenants.length > 0 && (
        <div className="overview-grid overview-grid-section">
          <AllTenantsApprovalsSection orgNames={orgNames} state={inboxState} />
          <AllTenantsClusterRollup orgs={orgs} orgNames={orgNames} />
          <AllTenantsActivitySection orgs={orgs} orgNames={orgNames} />
        </div>
      )}
    </div>
  );
}
