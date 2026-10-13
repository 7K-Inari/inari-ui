import * as React from "react";

import { decideApproval, decideReason, listApprovals, type ApprovalRequest } from "@/api/approvals";
import { useAsyncResource, type AsyncState } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { usePermissions } from "@/auth/permissions-context";
import { Button } from "7k-design-system/react";
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
    <div className="overview-card-stack">
      <ul className="list">
        {approvals.slice(0, MAX_ITEMS).map((a) => (
          <li key={a.id} className="list-item overview-approval-row">
            <div className="overview-approval-main">
              <p className="overview-approval-title">{a.title}</p>
              <p className="mono-caption">{a.requestedBy}</p>
            </div>
            <div className="overview-approval-actions">
              {onDecide && (
                <>
                  <Button
                    variant="accent"
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() => handle(a.id, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() => handle(a.id, "reject")}
                  >
                    Reject
                  </Button>
                </>
              )}
              <span className="mono-caption">{formatRelative(a.requestedAt)}</span>
            </div>
          </li>
        ))}
      </ul>
      {decideError && (
        <p role="alert" className="alert alert-danger">
          Decision failed: {decideError}
        </p>
      )}
    </div>
  );
}

export function PendingApprovalsCard({ state: shared }: { state?: AsyncState<ApprovalRequest[]> }) {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const permissions = usePermissions();
  const own = useAsyncResource((token) => listApprovals(token, tenant, "inbox"), [tenant], {
    refetchIntervalMs: 15_000,
    enabled: !shared,
  });
  const state = shared ?? own;

  // Per-tenant projection absent => unknown => buttons shown; an explicit
  // `false` hides them (plan §5: gate on projection when present).
  const canDecide = permissions.tenants?.[tenant]?.canDecideApprovals !== false;

  const onDecide: DecideFn | undefined = canDecide
    ? async (id, decision) => {
        await decideApproval(token, tenant, id, decision, decideReason(decision));
        state.refetch();
      }
    : undefined;

  const pendingCount = state.data?.length ?? 0;

  return (
    <OverviewCard
      title="Pending approvals"
      testId="card-pending-approvals"
      href={tenantLink(tenant, "approvals")}
      state={state}
      accentTop={pendingCount > 0}
      isEmpty={(approvals) => approvals.length === 0}
      empty={<p>No pending approvals. Requests that need a decision will appear here.</p>}
    >
      {(approvals: ApprovalRequest[]) => (
        <div className="overview-card-stack">
          <p className={pendingCount > 0 ? "overview-stat-accent" : undefined}>
            <span className="stat-value">{approvals.length}</span> pending
          </p>
          <ApprovalListItems approvals={approvals} onDecide={onDecide} />
        </div>
      )}
    </OverviewCard>
  );
}
