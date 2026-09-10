import { Link } from "react-router-dom";

import { decideApproval, decideReason, listApprovalsInbox } from "@/api/approvals";
import type { ApprovalRequest } from "@/api/approvals";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { usePermissions } from "@/auth/permissions-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantLink } from "@/tenant/tenant-link";
import { isForbidden } from "@/pages/overview/overview-card";
import { ApprovalListItems, type DecideFn } from "@/pages/overview/pending-approvals-card";

export const ALL_TENANTS_POLL_MS = 60_000;

interface SectionProps {
  orgNames: Map<string, string>;
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
    <div
      data-testid={`org-error-${org}`}
      className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
    >
      <span className="text-destructive">
        {name}: failed to load ({message})
      </span>
      <Button variant="outline" size="sm" className="ml-auto" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function OverflowNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      …and {count} more {count === 1 ? "organization" : "organizations"} not shown
    </p>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-2 py-1" aria-busy="true">
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
    </div>
  );
}

export { SectionSkeleton };

// Pending approvals from the caller-scoped aggregate endpoint
// (GET /approvals/inbox, server v1.6.0), grouped client-side by org. One
// request covers every org — no fan-out cap, so no org is ever hidden.
export function AllTenantsApprovalsSection({ orgNames }: SectionProps) {
  const { token } = useAuth();
  const permissions = usePermissions();
  const { data, loading, error, refetch } = useAsyncResource(
    (tok) => listApprovalsInbox(tok),
    [],
    { refetchIntervalMs: ALL_TENANTS_POLL_MS },
  );

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
      <CardHeader>
        <CardTitle className="text-base">Pending approvals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {firstLoad && <SectionSkeleton />}
        {[...groups.entries()].map(([org, approvals]) => (
          <div key={org} data-testid={`all-approvals-org-${org}`} className="space-y-2">
            <div className="flex items-center justify-between">
              <Link
                to={tenantLink(org, "approvals")}
                className="text-sm font-medium text-primary hover:underline"
              >
                {orgNames.get(org) ?? org}
              </Link>
              <span className="text-xs text-muted-foreground">
                {approvals.length} pending
              </span>
            </div>
            <ApprovalListItems approvals={approvals} onDecide={decideFor(org)} />
          </div>
        ))}
        {showError && (
          <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <span className="text-destructive">
              Failed to load ({error?.message ?? "Request failed"})
            </span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={refetch}>
              Retry
            </Button>
          </div>
        )}
        {allEmpty && (
          <p className="py-2 text-sm text-muted-foreground">
            No pending approvals across your organizations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
