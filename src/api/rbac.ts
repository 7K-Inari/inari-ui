import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// RBAC mapping (§5.4): Keycloak groups (tenant-<slug>/<team>) are mapped to
// per-tenant ClusterRoles. Membership lives in Keycloak; the console manages
// only the mapping.

export type KeycloakGroup = components["schemas"]["RbacGroup"];
export type TenantClusterRole = components["schemas"]["RbacClusterRole"];
export type RbacMapping = components["schemas"]["RbacMapping"];
type GetRBACMatrixOutputBody = components["schemas"]["GetRBACMatrixOutputBody"];
type PutRBACMappingsInputBody =
  components["schemas"]["PutRBACMappingsInputBody"];
type PutRBACMappingsOutputBody =
  components["schemas"]["PutRBACMappingsOutputBody"];
type TeamRoleMapping = components["schemas"]["TeamRoleMapping"];
export type TeamRoleChange = components["schemas"]["TeamRoleChange"];

// Normalized view model: the contract types the matrix arrays as nullable;
// the UI treats "no entries" and "empty" identically.
export interface RbacMatrix {
  groups: KeycloakGroup[];
  roles: TenantClusterRole[];
  mappings: RbacMapping[];
}

function normalize(body: GetRBACMatrixOutputBody): RbacMatrix {
  return {
    groups: body.rbac.groups ?? [],
    roles: body.rbac.roles ?? [],
    mappings: body.rbac.mappings ?? [],
  };
}

export async function getRbacMatrix(
  token: string | undefined,
  tenant: string,
): Promise<RbacMatrix> {
  const res = await apiFetch<GetRBACMatrixOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/rbac`,
    { token },
  );
  return normalize(res);
}

// The write contract is team→role (TeamRoleMapping); the read projection is
// groupPath→clusterRole. Translate via the matrix's group list; fall back to
// the group path's trailing segment when the group is unknown.
function toTeamRoleMappings(
  matrix: RbacMatrix,
  mappings: RbacMapping[],
): TeamRoleMapping[] {
  const teamByPath = new Map(matrix.groups.map((g) => [g.path, g.team]));
  return mappings.map((m) => ({
    team: teamByPath.get(m.groupPath) ?? m.groupPath.split("/").pop()!,
    role: m.clusterRole,
  }));
}

async function putMappings(
  token: string | undefined,
  tenant: string,
  body: PutRBACMappingsInputBody,
): Promise<TeamRoleChange[]> {
  const res = await apiFetch<PutRBACMappingsOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/rbac/mappings`,
    { token, method: "PUT", body },
  );
  return res.changes ?? [];
}

// Declarative whole-set replace (M6.W3 settings editor): the settings page
// submits the full desired mapping set in one call rather than N sequential
// per-cell writes.
export async function putRbacMappings(
  token: string | undefined,
  tenant: string,
  mappings: RbacMapping[],
): Promise<TeamRoleChange[]> {
  const matrix = await getRbacMatrix(token, tenant);
  return putMappings(token, tenant, {
    mappings: toTeamRoleMappings(matrix, mappings),
  });
}

// Single-cell toggle: composed client-side over the declarative bulk PUT —
// the contract defines no per-cell write (a {groupPath, clusterRole, mapped}
// body would be rejected with 422).
export async function setRbacMapping(
  token: string | undefined,
  tenant: string,
  groupPath: string,
  clusterRole: string,
  mapped: boolean,
): Promise<TeamRoleChange[]> {
  const matrix = await getRbacMatrix(token, tenant);
  const key = (m: RbacMapping) => `${m.groupPath}::${m.clusterRole}`;
  const target = `${groupPath}::${clusterRole}`;
  const rest = matrix.mappings.filter((m) => key(m) !== target);
  const next = mapped ? [...rest, { groupPath, clusterRole }] : rest;
  return putMappings(token, tenant, {
    mappings: toTeamRoleMappings(matrix, next),
  });
}
