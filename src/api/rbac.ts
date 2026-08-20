import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// RBAC mapping (§5.4): Keycloak groups (tenant-<slug>/<team>) are mapped to
// per-tenant ClusterRoles. Membership lives in Keycloak; the console manages
// only the mapping.

export interface KeycloakGroup {
  path: string; // e.g. tenant-acme/platform-team
  team: string;
  memberCount: number;
}

export interface TenantClusterRole {
  name: string; // e.g. tenant-acme-operator
  kind: "operator" | "viewer";
  description: string;
}

export interface RbacMapping {
  groupPath: string;
  clusterRole: string;
}

export interface RbacMatrix {
  groups: KeycloakGroup[];
  roles: TenantClusterRole[];
  mappings: RbacMapping[];
}

export async function getRbacMatrix(
  token: string | undefined,
  tenant: string,
): Promise<RbacMatrix> {
  const res = await apiFetch<{ rbac: RbacMatrix }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/rbac`,
    { token },
  );
  return res.rbac;
}

export async function setRbacMapping(
  token: string | undefined,
  tenant: string,
  groupPath: string,
  clusterRole: string,
  mapped: boolean,
): Promise<void> {
  await apiFetch(`/tenants/${encodeURIComponent(resolveTenant(tenant))}/rbac/mappings`, {
    token,
    method: "PUT",
    body: { groupPath, clusterRole, mapped },
  });
}
