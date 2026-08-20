import * as React from "react";

import { decideApproval, listApprovals } from "@/api/approvals";
import type { ApprovalRequest, ApprovalStatus } from "@/api/approvals";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";

type View = "inbox" | "requested";

const STATUS_VARIANTS: Record<ApprovalStatus, "warning" | "success" | "destructive" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  expired: "muted",
};

function StatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>;
}

export function ApprovalsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [view, setView] = React.useState<View>("inbox");
  const { data: approvals, loading, error, refetch } = useAsyncResource(
    (t) => listApprovals(t, tenant, view),
    [tenant, view],
  );
  const [deciding, setDeciding] = React.useState<{
    id: string;
    decision: "approve" | "reject";
  } | null>(null);
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);

  function startDecision(id: string, decision: "approve" | "reject") {
    setDeciding({ id, decision });
    setReason("");
    setDecisionError(null);
  }

  async function confirmDecision() {
    if (!deciding || !reason.trim()) {
      setDecisionError("A decision reason is required.");
      return;
    }
    setSubmitting(true);
    setDecisionError(null);
    try {
      await decideApproval(token, tenant, deciding.id, deciding.decision, reason.trim());
      setDeciding(null);
      setReason("");
      refetch();
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setSubmitting(false);
    }
  }

  const items = approvals ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Requests waiting for a decision, and requests you filed.
        </p>
      </div>

      <div className="flex gap-1" role="group" aria-label="Approvals view">
        <Button
          variant={view === "inbox" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setView("inbox")}
        >
          Inbox
        </Button>
        <Button
          variant={view === "requested" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setView("requested")}
        >
          Requested
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load approvals: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !approvals && (
        <p className="text-sm text-muted-foreground">Loading approvals…</p>
      )}

      {!error && approvals && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {view === "inbox"
              ? "Nothing waiting for your decision."
              : "You have not filed any approval requests."}
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 font-medium">Request</th>
                <th className="px-4 py-2 font-medium">Requested by</th>
                <th className="px-4 py-2 font-medium">Requested</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Decision</th>
                {view === "inbox" && <th className="px-4 py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((approval) => (
                <ApprovalRow
                  key={approval.id}
                  approval={approval}
                  view={view}
                  deciding={deciding}
                  reason={reason}
                  submitting={submitting}
                  decisionError={decisionError}
                  onStartDecision={startDecision}
                  onCancelDecision={() => setDeciding(null)}
                  onReasonChange={setReason}
                  onConfirm={() => void confirmDecision()}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ApprovalRowProps {
  approval: ApprovalRequest;
  view: View;
  deciding: { id: string; decision: "approve" | "reject" } | null;
  reason: string;
  submitting: boolean;
  decisionError: string | null;
  onStartDecision: (id: string, decision: "approve" | "reject") => void;
  onCancelDecision: () => void;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
}

function ApprovalRow({
  approval,
  view,
  deciding,
  reason,
  submitting,
  decisionError,
  onStartDecision,
  onCancelDecision,
  onReasonChange,
  onConfirm,
}: ApprovalRowProps) {
  const isDeciding = deciding?.id === approval.id;
  const decided = approval.status !== "pending";

  return (
    <React.Fragment>
      <tr className="border-t hover:bg-muted/30">
        <td className="px-4 py-2">
          <Badge variant="outline">{approval.kind}</Badge>
        </td>
        <td className="px-4 py-2">
          <div className="font-medium">{approval.title}</div>
          <div className="text-xs text-muted-foreground">{approval.description}</div>
        </td>
        <td className="px-4 py-2 font-mono text-xs">{approval.requestedBy}</td>
        <td className="px-4 py-2 text-muted-foreground">
          <span title={approval.requestedAt}>{formatRelative(approval.requestedAt)}</span>
        </td>
        <td className="px-4 py-2">
          <StatusBadge status={approval.status} />
        </td>
        <td className="px-4 py-2 text-xs">
          {decided && approval.decidedBy ? (
            <div>
              <div className="font-mono">{approval.decidedBy}</div>
              {approval.decisionReason && (
                <div className="text-muted-foreground">{approval.decisionReason}</div>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        {view === "inbox" && (
          <td className="px-4 py-2">
            {approval.status === "pending" && !isDeciding && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => onStartDecision(approval.id, "approve")}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStartDecision(approval.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            )}
          </td>
        )}
      </tr>
      {isDeciding && (
        <tr className="border-t bg-muted/30">
          <td className="px-4 py-2" colSpan={view === "inbox" ? 7 : 6}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">
                Reason for {deciding.decision === "approve" ? "approval" : "rejection"}:
              </span>
              <Input
                aria-label="Decision reason"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Required"
                className="h-8 w-72"
              />
              <Button size="sm" disabled={submitting || !reason.trim()} onClick={onConfirm}>
                Confirm {deciding.decision}
              </Button>
              <Button size="sm" variant="ghost" disabled={submitting} onClick={onCancelDecision}>
                Cancel
              </Button>
              {decisionError && <span className="text-sm text-destructive">{decisionError}</span>}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
