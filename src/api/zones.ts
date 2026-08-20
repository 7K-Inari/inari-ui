import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Tenant zones (§5.12): vending a zone is a staged pipeline
// (account → trust → EKS → wiring → Active). Decommission is gated by an
// approval before any teardown starts.

export type ZoneStatus =
  | "provisioning"
  | "active"
  | "decommission_requested"
  | "decommissioning"
  | "decommissioned"
  | "failed";

export type ZoneStepName = "account" | "trust" | "eks" | "wiring";
export type ZoneStepStatus = "pending" | "in_progress" | "done" | "failed";

export interface ZoneStep {
  name: ZoneStepName;
  status: ZoneStepStatus;
  message: string | null;
}

export interface TenantZone {
  id: string;
  tenant: string;
  name: string;
  slug: string;
  orgUnit: string;
  region: string;
  tier: "starter";
  status: ZoneStatus;
  steps: ZoneStep[];
  cloudAccountId: string | null;
  clusterId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateZoneRequest {
  name: string;
  slug: string;
  orgUnit: string;
  region: string;
  tier: "starter";
}

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function listZones(
  token: string | undefined,
  tenant: string,
): Promise<TenantZone[]> {
  const res = await apiFetch<{ zones: TenantZone[] | null }>(`${tenantPath(tenant)}/zones`, {
    token,
  });
  return res.zones ?? [];
}

export async function getZone(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<TenantZone> {
  const res = await apiFetch<{ zone: TenantZone }>(
    `${tenantPath(resolveTenant(tenant))}/zones/${encodeURIComponent(id)}`,
    { token },
  );
  return res.zone;
}

export async function createZone(
  token: string | undefined,
  tenant: string,
  body: CreateZoneRequest,
): Promise<TenantZone> {
  const res = await apiFetch<{ zone: TenantZone }>(`${tenantPath(tenant)}/zones`, {
    token,
    method: "POST",
    body,
  });
  return res.zone;
}

export async function requestZoneDecommission(
  token: string | undefined,
  tenant: string,
  id: string,
  reason: string,
): Promise<TenantZone> {
  const res = await apiFetch<{ zone: TenantZone }>(
    `${tenantPath(tenant)}/zones/${encodeURIComponent(id)}/decommission`,
    { token, method: "POST", body: { reason } },
  );
  return res.zone;
}
