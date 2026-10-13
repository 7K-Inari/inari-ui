import * as React from "react";
import {
  Alert,
  Badge,
  Button,
  Modal,
  Skeleton,
  Textarea,
} from "7k-design-system/react";

import { decideApproval, listApprovals } from "@/api/approvals";
import type { ApprovalRequest, ApprovalStatus } from "@/api/approvals";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { PageHeader } from "@/components/page-header";
import { formatRelative } from "@/lib/time";
import { statusToBadge } from "@/lib/status-badges";
import { useTenant } from "@/tenant/tenant-context";

type View = "inbox" | "requested";

function StatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge variant={statusToBadge(status)}>{status}</Badge>;
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
  const pendingCount = view === "inbox" ? items.filter((a) => a.status === "pending").length : 0;

  return (
    <div>
      <PageHeader
        breadcrumb="Deliver / Approvals"
        title="Approvals"
        actions={
          <div className="tabs" role="group" aria-label="Approvals view">
            <button
              type="button"
              className={`tab tab-accent${view === "inbox" ? " active" : ""}`}
              onClick={() => setView("inbox")}
            >
              Inbox {pendingCount > 0 && <Badge variant="warning">{pendingCount}</Badge>}
            </button>
            <button
              type="button"
              className={`tab tab-accent${view === "requested" ? " active" : ""}`}
              onClick={() => setView("requested")}
            >
              Requested
            </button>
          </div>
        }
      />

      {error && (
        <Alert variant="danger">
          <span>Failed to load approvals: {error.message}</span>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </Alert>
      )}

      {!error && loading && !approvals && (
        <div className="overview-card-skeleton" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={40} />
          ))}
        </div>
      )}

      {!error && approvals && items.length === 0 && (
        <div className="empty">
          <span className="empty-title">
            {view === "inbox" ? "No pending approvals" : "No requests filed"}
          </span>
          <span className="empty-text">
            {view === "inbox"
              ? "Nothing waiting for your decision."
              : "You have not filed any approval requests."}
          </span>
          {view === "inbox" && <Badge variant="success">Queue clear</Badge>}
        </div>
      )}

      {items.length > 0 && (
        <ul className="list approvals-list">
          {items.map((approval) => (
            <ApprovalRow
              key={approval.id}
              approval={approval}
              view={view}
              onStartDecision={startDecision}
            />
          ))}
        </ul>
      )}

      <Modal
        open={deciding !== null}
        onClose={() => setDeciding(null)}
        aria-label="Approval decision"
      >
        {deciding && (
          <div className="decision-modal">
            <h2 className="mono-label">
              Reason for {deciding.decision === "approve" ? "approval" : "rejection"}
            </h2>
            <Textarea
              aria-label="Decision reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required"
            />
            {decisionError && <p className="field-error">{decisionError}</p>}
            <div className="wizard-actions">
              <Button variant="ghost" disabled={submitting} onClick={() => setDeciding(null)}>
                Cancel
              </Button>
              <Button
                variant={deciding.decision === "approve" ? "accent" : "danger"}
                disabled={submitting || !reason.trim()}
                onClick={() => void confirmDecision()}
              >
                Confirm {deciding.decision}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ApprovalRow({
  approval,
  view,
  onStartDecision,
}: {
  approval: ApprovalRequest;
  view: View;
  onStartDecision: (id: string, decision: "approve" | "reject") => void;
}) {
  const decided = approval.status !== "pending";

  return (
    <li className="list-item approvals-row">
      <span className="tag">{approval.kind}</span>
      <div className="approvals-row-main">
        <p className="overview-approval-title">{approval.title}</p>
        <p className="mono-caption">{approval.requestedBy}</p>
      </div>
      <span className="mono-caption" title={approval.requestedAt}>
        {formatRelative(approval.requestedAt)}
      </span>
      <StatusBadge status={approval.status} />
      {decided && approval.decidedBy ? (
        <span className="approvals-row-decision">
          <span className="mono-caption">{approval.decidedBy}</span>
          {approval.decisionReason && (
            <span className="mono-caption">{approval.decisionReason}</span>
          )}
        </span>
      ) : (
        <span className="mono-caption">—</span>
      )}
      {view === "inbox" && approval.status === "pending" && (
        <div className="approvals-row-actions">
          <Button size="sm" variant="accent" onClick={() => onStartDecision(approval.id, "approve")}>
            Approve
          </Button>
          <Button size="sm" variant="danger" onClick={() => onStartDecision(approval.id, "reject")}>
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}
