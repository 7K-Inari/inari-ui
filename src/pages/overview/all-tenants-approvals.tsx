import { Link } from "react-router-dom";

import { decideApproval, decideReason, listApprovals } from "@/api/approvals";
import { useAuth } from "@/auth/auth-context";
import { usePermissions } from "@/auth/permissions-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantLink } from "@/tenant/tenant-link";
import { isForbidden } from "@/pages/overview/overview-card";
import { ApprovalListItems, type DecideFn } from "@/pages/overview/pending-approvals-card";
import { useOrgFanout } from "@/pages/overview/use-org-fanout";

export const ALL_TENANTS_POLL_MS = 60_000;

interface SectionProps {
  orgs: string[];
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

// Pending approvals fanned out across the caller's orgs, grouped by org. One
// failing org degrades to an inline chip; it never blanks the other groups.
export function AllTenantsApprovalsSection({ orgs, orgNames }: SectionProps) {
  const { token } = useAuth();
  const permissions = usePermissions();
  const { entries, overflow, refetchAll } = useOrgFanout(
    orgs,
    (token, org) => listApprovals(token, org, "inbox"),
    { refetchIntervalMs: ALL_TENANTS_POLL_MS },
  );

  const decideFor = (org: string): DecideFn | undefined =>
    permissions.tenants?.[org]?.canDecideApprovals === false
      ? undefined
      : async (id, decision) => {
          await decideApproval(token, org, id, decision, decideReason(decision));
          refetchAll();
        };

  const firstLoad =
    entries.length > 0 && entries.every((e) => e.state.data === null && e.state.loading);
  const groups = entries.filter((e) => (e.state.data?.length ?? 0) > 0);
  const errors = entries.filter(
    (e) => e.state.error && !e.state.data && !isForbidden(e.state.error),
  );
  const allEmpty =
    entries.length > 0 &&
    entries.every((e) => e.state.data !== null && e.state.data.length === 0);

  return (
    <Card data-testid="all-approvals">
      <CardHeader>
        <CardTitle className="text-base">Pending approvals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {firstLoad && <SectionSkeleton />}
        {groups.map(({ org, state }) => (
          <div key={org} data-testid={`all-approvals-org-${org}`} className="space-y-2">
            <div className="flex items-center justify-between">
              <Link
                to={tenantLink(org, "approvals")}
                className="text-sm font-medium text-primary hover:underline"
              >
                {orgNames.get(org) ?? org}
              </Link>
              <span className="text-xs text-muted-foreground">
                {state.data?.length} pending
              </span>
            </div>
            <ApprovalListItems approvals={state.data ?? []} onDecide={decideFor(org)} />
          </div>
        ))}
        {errors.map(({ org, state }) => (
          <OrgErrorChip
            key={org}
            org={org}
            name={orgNames.get(org) ?? org}
            message={state.error?.message ?? "Request failed"}
            onRetry={refetchAll}
          />
        ))}
        {allEmpty && (
          <p className="py-2 text-sm text-muted-foreground">
            No pending approvals across your organizations.
          </p>
        )}
        <OverflowNote count={overflow} />
      </CardContent>
    </Card>
  );
}
