import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Tenant zones (§5.12): vending a zone is a staged pipeline
// (preflight → account_vend → trust_bootstrap → eks_provision → inari_wiring),
// torn down in reverse (cordon → drain → eks_delete → account_close →
// identity_revoke → audit_archive). Decommission is gated by an approval
// before any teardown starts.
// Server shapes come from the huma-generated OpenAPI contract (pinned
// snapshot in openapi/openapi.yaml); the exported interfaces below are UI
// view models consumed by zone pages and mocks.

export type ZoneStatus =
  | "requested"
  | "pending_approval"
  | "provisioning"
  | "wiring"
  | "active"
  | "failed"
  | "manual_intervention"
  | "decommission_pending_approval"
  | "cordoning"
  | "draining"
  | "decommissioning"
  | "closed";

// Step names/statuses are free-form strings on the wire; these unions mirror
// the server constants (inari-server internal/types).
export type ZoneStepName =
  | "preflight"
  | "account_vend"
  | "trust_bootstrap"
  | "eks_provision"
  | "inari_wiring"
  | "cordon"
  | "drain"
  | "eks_delete"
  | "account_close"
  | "identity_revoke"
  | "audit_archive";

export type ZoneStepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "skipped";

export interface ZoneStep {
  name: string;
  status: ZoneStepStatus;
  attempts: number;
  detail: string | null;
  externalRef: string | null;
  updatedAt: string;
}

export interface TenantZone {
  id: string;
  tenant: string;
  name: string;
  slug: string;
  orgUnit: string;
  region: string;
  tier: string;
  status: ZoneStatus;
  steps: ZoneStep[];
  cloudAccountId: string | null;
  clusterId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateZoneRequest {
  slug: string;
  displayName: string;
  ouId: string;
  managementAccountId: string;
  region: string;
  tier: string;
  tags?: Record<string, string>;
}

export interface DecommissionResult {
  // Present when the request is approval-gated; null when the server starts
  // teardown immediately (approvals disabled).
  approvalId: string | null;
}

type ServerTenantZone = components["schemas"]["TenantZone"];
type ServerTenantZoneStep = components["schemas"]["TenantZoneStep"];
type ListZonesResponse = components["schemas"]["ListZonesOutputBody"];
type ZoneResponse = components["schemas"]["RequestZoneOutputBody"];
type GetZoneResponse = components["schemas"]["GetZoneOutputBody"];
type DecommissionResponse = components["schemas"]["DecommissionOutputBody1"];

// Canonical step order (server constants), so the UI renders the pipeline
// deterministically regardless of map key order. Unknown steps (e.g. added
// by a newer server) sort last, alphabetically.
const STEP_ORDER: ZoneStepName[] = [
  "preflight",
  "account_vend",
  "trust_bootstrap",
  "eks_provision",
  "inari_wiring",
  "cordon",
  "drain",
  "eks_delete",
  "account_close",
  "identity_revoke",
  "audit_archive",
];

function mapSteps(steps: Record<string, ServerTenantZoneStep>): ZoneStep[] {
  return Object.entries(steps ?? {})
    .map(([name, s]) => ({
      name,
      status: (s.status ?? "pending") as ZoneStepStatus,
      attempts: s.attempts ?? 0,
      detail: typeof s.detail === "string" ? s.detail : null,
      externalRef: s.externalRef ?? null,
      updatedAt: s.updatedAt,
    }))
    .sort((a, b) => {
      const ia = STEP_ORDER.indexOf(a.name as ZoneStepName);
      const ib = STEP_ORDER.indexOf(b.name as ZoneStepName);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}

function mapZone(z: ServerTenantZone): TenantZone {
  return {
    id: z.id,
    tenant: z.ownerOrgId || z.orgId || "",
    name: z.displayName,
    slug: z.slug,
    orgUnit: z.ouId,
    region: z.region,
    tier: z.tier,
    status: z.state as ZoneStatus,
    // Provisioning steps are a separate payload (TenantZoneStep map) only
    // returned by GET /zones/{id}; summaries and list entries embed no steps.
    steps: [],
    cloudAccountId: z.cloudAccountId ?? null,
    clusterId: z.clusterId ?? null,
    createdAt: z.createdAt,
    updatedAt: z.updatedAt,
  };
}

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function listZones(
  token: string | undefined,
  tenant: string,
): Promise<TenantZone[]> {
  const res = await apiFetch<ListZonesResponse>(`${tenantPath(tenant)}/zones`, {
    token,
  });
  return (res.zones ?? []).map(mapZone);
}

export async function getZone(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<TenantZone> {
  const res = await apiFetch<GetZoneResponse>(
    `${tenantPath(resolveTenant(tenant))}/zones/${encodeURIComponent(id)}`,
    { token },
  );
  // GetZoneOutputBody carries the steps as a TenantZoneStep map alongside the
  // zone; merge them into the view model in canonical order.
  return { ...mapZone(res.zone), steps: mapSteps(res.steps ?? {}) };
}

export async function createZone(
  token: string | undefined,
  tenant: string,
  body: CreateZoneRequest,
): Promise<TenantZone> {
  const res = await apiFetch<ZoneResponse>(`${tenantPath(tenant)}/zones`, {
    token,
    method: "POST",
    body,
  });
  return mapZone(res.zone);
}

export async function requestZoneDecommission(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<DecommissionResult> {
  // The huma contract takes no request body and returns only {approvalId};
  // the zone itself transitions to decommission_pending_approval and is read
  // back via getZone.
  const res = await apiFetch<DecommissionResponse>(
    `${tenantPath(tenant)}/zones/${encodeURIComponent(id)}/decommission`,
    { token, method: "POST" },
  );
  return { approvalId: res.approvalId ?? null };
}
