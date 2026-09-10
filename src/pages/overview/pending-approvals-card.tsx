import * as React from "react";

import { decideApproval, decideReason, listApprovals, type ApprovalRequest } from "@/api/approvals";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { usePermissions } from "@/auth/permissions-context";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { OverviewCard } from "@/pages/overview/overview-card";

const MAX_ITEMS = 5;

export type DecideFn = (id: string, decision: "approve" | "reject") => Promise<void>;

// Shared with the all-tenants home (org-grouped mode): the top-5 pending
// approvals list with requester and relative age. When `onDecide` is provided,
// each row shows inline approve/reject buttons; decisions are followed by a
// refetch (no optimistic removal — polling reconciles).
export function ApprovalListItems({
  approvals,
  onDecide,
}: {
  approvals: ApprovalRequest[];
  onDecide?: DecideFn;
}) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [decideError, setDecideError] = React.useState<string | null>(null);

  async function handle(id: string, decision: "approve" | "reject") {
    if (!onDecide) return;
    setPendingId(id);
    setDecideError(null);
    try {
      await onDecide(id, decision);
    } catch (err) {
      setDecideError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {approvals.slice(0, MAX_ITEMS).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.requestedBy}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onDecide && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() => handle(a.id, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() => handle(a.id, "reject")}
                  >
                    Reject
                  </Button>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {formatRelative(a.requestedAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {decideError && (
        <p role="alert" className="text-sm text-destructive">
          Decision failed: {decideError}
        </p>
      )}
    </div>
  );
}

export function PendingApprovalsCard() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const permissions = usePermissions();
  const state = useAsyncResource((token) => listApprovals(token, tenant, "inbox"), [tenant], {
    refetchIntervalMs: 15_000,
  });

  // Per-tenant projection absent => unknown => buttons shown; an explicit
  // `false` hides them (plan §5: gate on projection when present).
  const canDecide = permissions.tenants?.[tenant]?.canDecideApprovals !== false;

  const onDecide: DecideFn | undefined = canDecide
    ? async (id, decision) => {
        await decideApproval(token, tenant, id, decision, decideReason(decision));
        state.refetch();
      }
    : undefined;

  return (
    <OverviewCard
      title="Pending approvals"
      testId="card-pending-approvals"
      href={tenantLink(tenant, "approvals")}
      state={state}
      isEmpty={(approvals) => approvals.length === 0}
      empty={<p>No pending approvals. Requests that need a decision will appear here.</p>}
    >
      {(approvals: ApprovalRequest[]) => (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="text-3xl font-semibold text-foreground">{approvals.length}</span>{" "}
            pending
          </p>
          <ApprovalListItems approvals={approvals} onDecide={onDecide} />
        </div>
      )}
    </OverviewCard>
  );
}
