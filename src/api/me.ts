import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";

// Global permissions are computed server-side by the OpenFGA-backed
// authorization brain (M1.W2); the UI only consumes this projection.
type MyPermissionsOutputBody = components["schemas"]["MyPermissionsOutputBody"];
type TenantCapabilities = components["schemas"]["TenantCapabilities"];

// Per-tenant capability projection (`tenants` on GET /me/permissions). The
// contract fixes canDeploy/canManageMembers/canManageTeams/canManageRbac;
// the extra optional flags are UI-side forward-compat consumed by overview
// pages. Parse defensively: an absent projection is "unknown", never denial.
export interface TenantPermissions extends Partial<TenantCapabilities> {
  canDecideApprovals?: boolean;
  canRegisterClusters?: boolean;
  canConnectCloudAccounts?: boolean;
}

// UI view model over MyPermissionsOutputBody.
export interface MyPermissions {
  canCreateOrganizations: boolean;
  tenants?: Record<string, TenantPermissions>;
  // Effective org role names per tenant slug (ADR-0013: a set, custom roles
  // have no total order), mirroring the members API. Absent on older
  // servers — treat as "unknown", never as denial.
  roles?: Record<string, string[]>;
}

const TENANT_FLAGS = [
  "canDecideApprovals",
  "canRegisterClusters",
  "canConnectCloudAccounts",
  "canDeploy",
  "canManageMembers",
  "canManageTeams",
  "canManageRbac",
] as const;

function parseTenantPermissions(raw: unknown): Record<string, TenantPermissions> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const out: Record<string, TenantPermissions> = {};
  for (const [org, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const flags: TenantPermissions = {};
    for (const flag of TENANT_FLAGS) {
      const v = (value as Record<string, unknown>)[flag];
      if (typeof v === "boolean") flags[flag] = v;
    }
    out[org] = flags;
  }
  return out;
}

export async function fetchMyPermissions(
  token: string | undefined,
): Promise<MyPermissions> {
  const res = await apiFetch<MyPermissionsOutputBody>(`/me/permissions`, { token });
  const tenants = parseTenantPermissions(res.tenants);
  const roles = parseOrgRoles(res.roles);
  return {
    canCreateOrganizations: res.canCreateOrganizations === true,
    ...(tenants ? { tenants } : {}),
    ...(roles ? { roles } : {}),
  };
}

function parseOrgRoles(raw: unknown): Record<string, string[]> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const out: Record<string, string[]> = {};
  for (const [org, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[org] = value.filter((v): v is string => typeof v === "string");
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
