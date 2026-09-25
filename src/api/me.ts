import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";

// Global permissions are computed server-side by the OpenFGA-backed
// authorization brain (M1.W2); the UI only consumes this projection.
type MyPermissionsOutputBody = components["schemas"]["MyPermissionsOutputBody"];

// Forward-compatible seam for a per-tenant permission projection the server
// has not shipped yet: parse it when present, treat its absence as "unknown"
// (never as denial).
export interface TenantPermissions {
  canDecideApprovals?: boolean;
  canRegisterClusters?: boolean;
  canConnectCloudAccounts?: boolean;
  canDeploy?: boolean;
}

// UI view model over MyPermissionsOutputBody plus the unshipped `tenants` seam.
export interface MyPermissions {
  canCreateOrganizations: boolean;
  tenants?: Record<string, TenantPermissions>;
  // Effective org role per tenant slug ("org-admin", "platform-engineer",
  // "developer", "viewer"), mirroring the members API. Absent on older
  // servers — treat as "unknown", never as denial.
  orgRoles?: Record<string, string>;
}

const TENANT_FLAGS = [
  "canDecideApprovals",
  "canRegisterClusters",
  "canConnectCloudAccounts",
  "canDeploy",
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
  const res = await apiFetch<MyPermissionsOutputBody & { tenants?: unknown }>(
    `/me/permissions`,
    { token },
  );
  const tenants = parseTenantPermissions(res.tenants);
  const orgRoles = parseOrgRoles(res.orgRoles);
  return {
    canCreateOrganizations: res.canCreateOrganizations === true,
    ...(tenants ? { tenants } : {}),
    ...(orgRoles ? { orgRoles } : {}),
  };
}

function parseOrgRoles(raw: unknown): Record<string, string> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const out: Record<string, string> = {};
  for (const [org, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[org] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
