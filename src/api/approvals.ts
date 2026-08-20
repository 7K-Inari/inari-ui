import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Approvals (plan §5.11): request-time OPA gates and approval workflows.
// The inbox holds requests the current user can decide; "requested" holds the
// requests the current user filed.

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
  id: string;
  tenant: string;
  kind: string; // e.g. deploy, zone-vend, zone-decommission, cloud-account
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}

export async function listApprovals(
  token: string | undefined,
  tenant: string,
  view: "inbox" | "requested",
): Promise<ApprovalRequest[]> {
  const res = await apiFetch<{ approvals: ApprovalRequest[] | null }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/approvals?view=${view}`,
    { token },
  );
  return res.approvals ?? [];
}

export async function decideApproval(
  token: string | undefined,
  tenant: string,
  id: string,
  decision: "approve" | "reject",
  reason: string,
): Promise<ApprovalRequest> {
  const res = await apiFetch<{ approval: ApprovalRequest }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/approvals/${encodeURIComponent(id)}/${decision}`,
    { token, method: "POST", body: { reason } },
  );
  return res.approval;
}
