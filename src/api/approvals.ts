import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Approvals (plan §5.11): request-time OPA gates and approval workflows.
// The inbox holds pending requests the current user can decide; "requested"
// holds the requests the current user filed (requester=me).
// Server shapes come from the huma-generated OpenAPI contract (pinned
// snapshot in openapi/openapi.yaml); the exported ApprovalRequest below is
// the UI view model consumed by pages and mocks.

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export interface ApprovalRequest {
  id: string;
  tenant: string;
  kind: string; // e.g. deploy, zone-vend, zone-decommission, cloud-account
  title: string;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}

type ServerApprovalRequest = components["schemas"]["ApprovalRequest"];
type ListApprovalsResponse = components["schemas"]["ListOutputBody"];
type DecideResponse = components["schemas"]["DecideOutputBody"];

function mapApproval(a: ServerApprovalRequest): ApprovalRequest {
  return {
    id: a.id,
    tenant: a.orgId,
    kind: a.action ?? "",
    title: a.name ?? "",
    requestedBy: a.requester,
    requestedAt: a.createdAt,
    status: a.state as ApprovalStatus,
    decidedBy: a.approver ?? null,
    decidedAt: a.decidedAt ?? null,
    decisionReason: a.reason ?? null,
  };
}

export async function listApprovals(
  token: string | undefined,
  tenant: string,
  view: "inbox" | "requested",
): Promise<ApprovalRequest[]> {
  // Wire contract: ?state=pending for the inbox, ?requester=me for own
  // requests — there is no "view" query parameter.
  const query = view === "requested" ? "requester=me" : "state=pending";
  const res = await apiFetch<ListApprovalsResponse>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/approvals?${query}`,
    { token },
  );
  return (res.approvals ?? []).map(mapApproval);
}

// Inline decide (overview cards) has no reason input; the server records a
// default rationale.
export function decideReason(decision: "approve" | "reject"): string {
  return decision === "approve" ? "Approved from overview" : "Rejected from overview";
}

export async function decideApproval(
  token: string | undefined,
  tenant: string,
  id: string,
  decision: "approve" | "reject",
  reason: string,
): Promise<ApprovalRequest> {
  const res = await apiFetch<DecideResponse>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/approvals/${encodeURIComponent(id)}/decide`,
    {
      token,
      method: "POST",
      // DecideInputBody: { approve: boolean, reason?: string }.
      body: { approve: decision === "approve", reason },
    },
  );
  return mapApproval(res.approval);
}
