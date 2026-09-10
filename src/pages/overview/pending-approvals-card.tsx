import { listApprovals, type ApprovalRequest } from "@/api/approvals";
import { useAsyncResource } from "@/api/hooks";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { OverviewCard } from "@/pages/overview/overview-card";

const MAX_ITEMS = 5;

export function PendingApprovalsCard() {
  const { tenant } = useTenant();
  const state = useAsyncResource((token) => listApprovals(token, tenant, "inbox"), [tenant], {
    refetchIntervalMs: 15_000,
  });

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
          <ul className="space-y-2">
            {approvals.slice(0, MAX_ITEMS).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.requestedBy}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelative(a.requestedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </OverviewCard>
  );
}
