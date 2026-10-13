import { Link } from "react-router-dom";

import { decideApproval, decideReason, listApprovalsInbox } from "@/api/approvals";
import type { ApprovalRequest } from "@/api/approvals";
import { useAsyncResource, type AsyncState } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { usePermissions } from "@/auth/permissions-context";
import { Alert, Button, Card, Skeleton } from "7k-design-system/react";
import { tenantLink } from "@/tenant/tenant-link";
import { isForbidden } from "@/pages/overview/overview-card";
import { ApprovalListItems, type DecideFn } from "@/pages/overview/pending-approvals-card";

export const ALL_TENANTS_POLL_MS = 60_000;

interface SectionProps {
  orgNames: Map<string, string>;
  // Optional shared inbox state (e.g. when the page-level stat row already
  // fetched the aggregate inbox) — avoids a duplicate request.
  state?: AsyncState<ApprovalRequest[]>;
}

export function OrgErrorChip({
  org,
  name,
  message,
  onRetry,
}: {
  org: string;
  name: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="danger" data-testid={`org-error-${org}`}>
      <span>
        {name}: failed to load ({message})
      </span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </Alert>
  );
}

export function OverflowNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="mono-caption">
      …and {count} more {count === 1 ? "organization" : "organizations"} not shown
    </p>
  );
}

function SectionSkeleton() {
  return (
    <div className="overview-card-skeleton" aria-busy="true">
      <Skeleton width="66%" height={14} />
      <Skeleton width="50%" height={14} />
      <Skeleton width="75%" height={14} />
    </div>
  );
}

export { SectionSkeleton };

// Pending approvals from the caller-scoped aggregate endpoint
// (GET /approvals/inbox, server v1.6.0), grouped client-side by org. One
// request covers every org — no fan-out cap, so no org is ever hidden.
export function AllTenantsApprovalsSection({ orgNames, state }: SectionProps) {
  const { token } = useAuth();
  const permissions = usePermissions();
  const own = useAsyncResource((tok) => listApprovalsInbox(tok), [], {
    refetchIntervalMs: ALL_TENANTS_POLL_MS,
    enabled: !state,
  });
  const { data, loading, error, refetch } = state ?? own;

  const decideFor = (org: string): DecideFn | undefined =>
    permissions.tenants?.[org]?.canDecideApprovals === false
      ? undefined
      : async (id, decision) => {
          await decideApproval(token, org, id, decision, decideReason(decision));
          refetch();
        };

  const firstLoad = loading && data === null;
  const groups = new Map<string, ApprovalRequest[]>();
  for (const approval of data ?? []) {
    const list = groups.get(approval.tenant) ?? [];
    list.push(approval);
    groups.set(approval.tenant, list);
  }
  const showError = error !== null && data === null && !isForbidden(error);
  const allEmpty = data !== null && data.length === 0;

  return (
    <Card data-testid="all-approvals">
      <div className="card-header overview-card-header">
        <span className="mono-label">Pending approvals</span>
      </div>
      <div className="card-body overview-card-stack">
        {firstLoad && <SectionSkeleton />}
        {[...groups.entries()].map(([org, approvals]) => (
          <div key={org} data-testid={`all-approvals-org-${org}`} className="space-y-2">
            <div className="flex items-center justify-between">
              <Link to={tenantLink(org, "approvals")} className="overview-card-link">
                {orgNames.get(org) ?? org}
              </Link>
              <span className="mono-caption">{approvals.length} pending</span>
            </div>
            <ApprovalListItems approvals={approvals} onDecide={decideFor(org)} />
          </div>
        ))}
        {showError && (
          <Alert variant="danger">
            <span>Failed to load ({error?.message ?? "Request failed"})</span>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Retry
            </Button>
          </Alert>
        )}
        {allEmpty && (
          <div className="empty">No pending approvals across your organizations.</div>
        )}
      </div>
    </Card>
  );
}
