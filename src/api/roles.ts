import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Role engine (ADR-0013): org roles are DB entities over a static permission
// catalog. Built-ins are deletion/rename-protected but their permission
// bundles are editable; the server enforces the tenant.admin guardrail (409)
// so a tenant can never lock itself out.
export type Role = components["schemas"]["Role"];
export type Permission = components["schemas"]["Permission"];
export type CreateRoleRequest = components["schemas"]["CreateRoleInputBody"];
export type UpdateRoleRequest = components["schemas"]["RolePatch"];
type ListRolesOutputBody = components["schemas"]["ListRolesOutputBody"];
type RoleOutputBody = components["schemas"]["RoleOutputBody"];
type PermissionCatalogOutputBody =
  components["schemas"]["PermissionCatalogOutputBody"];

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function listRoles(
  token: string | undefined,
  tenant: string,
): Promise<Role[]> {
  const res = await apiFetch<ListRolesOutputBody>(`${tenantPath(tenant)}/roles`, {
    token,
  });
  return res.roles ?? [];
}

export async function getPermissionCatalog(
  token: string | undefined,
  tenant: string,
): Promise<Permission[]> {
  const res = await apiFetch<PermissionCatalogOutputBody>(
    `${tenantPath(tenant)}/permissions/catalog`,
    { token },
  );
  return res.permissions ?? [];
}

export async function createRole(
  token: string | undefined,
  tenant: string,
  body: CreateRoleRequest,
): Promise<Role> {
  const res = await apiFetch<RoleOutputBody>(`${tenantPath(tenant)}/roles`, {
    token,
    method: "POST",
    body,
  });
  return res.role;
}

// role is a role name or ID; the patch carries only the fields being changed
// (built-in names are immutable — omit `name` when editing a built-in).
export async function updateRole(
  token: string | undefined,
  tenant: string,
  role: string,
  body: UpdateRoleRequest,
): Promise<Role> {
  const res = await apiFetch<RoleOutputBody>(
    `${tenantPath(tenant)}/roles/${encodeURIComponent(role)}`,
    { token, method: "PATCH", body },
  );
  return res.role;
}

export async function deleteRole(
  token: string | undefined,
  tenant: string,
  role: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/roles/${encodeURIComponent(role)}`,
    { token, method: "DELETE" },
  );
}
