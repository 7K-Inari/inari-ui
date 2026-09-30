import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Organization (tenant) creation is a platform-scoped operation: unlike other
// helpers it is not nested under /tenants/{org}/... (§5, §11/6).
// Types come from the huma-generated OpenAPI contract (pinned snapshot in
// openapi/openapi.yaml) — never hand-write server shapes; regenerate with
// `npm run codegen` after `npm run sync:api`.

type Organization = components["schemas"]["Organization"];
type CreateTenantRequest = components["schemas"]["CreateTenantInputBody"];
type CreateTenantResponse = components["schemas"]["TenantOutputBody"];
type ListTenantsResponse = components["schemas"]["ListTenantsOutputBody"];

export type Tenant = Organization;

type TenantGitConfig = components["schemas"]["TenantGitConfig"];
export type GitConfigRequest = components["schemas"]["GitConfigInputBody"];

export type Team = components["schemas"]["Team"];
export type MemberView = components["schemas"]["MemberView"];
// Org-wide members (ADR-0013): the role is a set of role names (direct grant
// plus team-derived), not a single "highest" role.
export type OrgMemberView = components["schemas"]["OrgMemberView"];
type ListTeamsResponse = components["schemas"]["ListTeamsOutputBody"];
type ListMembersResponse = components["schemas"]["ListMembersOutputBody"];
type ListOrgMembersResponse =
  components["schemas"]["ListOrgMembersOutputBody"];
type AddMemberRequest = components["schemas"]["AddMemberInputBody"];

export type PatchTenantRequest = components["schemas"]["UpdateTenantInputBody"];
// Server contract (setMemberRole): subject is a Keycloak user UUID or email;
// the body carries only the org role.
export type PutOrgMemberRequest = components["schemas"]["PutMemberInputBody"];
export type CreateTeamRequest = components["schemas"]["CreateTeamInputBody"];

// The only cross-tenant call in the contract: orgs visible to the caller
// (drives the tenant switcher and the all-tenants home).
export async function listTenants(token: string | undefined): Promise<Tenant[]> {
  const res = await apiFetch<ListTenantsResponse>(`/tenants`, { token });
  return res.tenants ?? [];
}

export async function createTenant(
  token: string | undefined,
  body: CreateTenantRequest,
): Promise<Tenant> {
  const res = await apiFetch<CreateTenantResponse>(`/tenants`, {
    token,
    method: "POST",
    body,
  });
  return res.organization;
}

// NOTE: the pinned snapshot declares a spurious required {id} path param on
// GET /tenants/{org}/git-config (huma artifact); the actual route has none.
export async function getGitConfig(
  token: string | undefined,
  tenant: string,
): Promise<TenantGitConfig> {
  const res = await apiFetch<{ config: TenantGitConfig }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/git-config`,
    { token },
  );
  return res.config;
}

export async function putGitConfig(
  token: string | undefined,
  tenant: string,
  body: GitConfigRequest,
): Promise<void> {
  await apiFetch<unknown>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/git-config`,
    { token, method: "PUT", body },
  );
}

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

// ---- org profile ----

export async function patchTenant(
  token: string | undefined,
  tenant: string,
  body: PatchTenantRequest,
): Promise<Tenant> {
  const res = await apiFetch<{ organization: Tenant }>(tenantPath(tenant), {
    token,
    method: "PATCH",
    body,
  });
  return res.organization;
}

// ---- org-wide members ----

function searchQuery(q?: string): string {
  return q ? `?q=${encodeURIComponent(q)}` : "";
}

// `q` filters members by email server-side (case-insensitive substring;
// M1.W1 user picker).
export async function listOrgMembers(
  token: string | undefined,
  tenant: string,
  opts?: { q?: string },
): Promise<OrgMemberView[]> {
  const res = await apiFetch<ListOrgMembersResponse>(
    `${tenantPath(tenant)}/members${searchQuery(opts?.q)}`,
    { token },
  );
  return res.members ?? [];
}

export async function putOrgMember(
  token: string | undefined,
  tenant: string,
  subject: string,
  body: PutOrgMemberRequest,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/members/${encodeURIComponent(subject)}`,
    { token, method: "PUT", body },
  );
}

export async function deleteOrgMember(
  token: string | undefined,
  tenant: string,
  subject: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/members/${encodeURIComponent(subject)}`,
    { token, method: "DELETE" },
  );
}

// ---- teams ----

export async function listTeams(
  token: string | undefined,
  tenant: string,
): Promise<Team[]> {
  const res = await apiFetch<ListTeamsResponse>(`${tenantPath(tenant)}/teams`, {
    token,
  });
  return res.teams ?? [];
}

export async function createTeam(
  token: string | undefined,
  tenant: string,
  body: CreateTeamRequest,
): Promise<Team> {
  const res = await apiFetch<{ team: Team }>(`${tenantPath(tenant)}/teams`, {
    token,
    method: "POST",
    body,
  });
  return res.team;
}

export async function deleteTeam(
  token: string | undefined,
  tenant: string,
  team: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/teams/${encodeURIComponent(team)}`,
    { token, method: "DELETE" },
  );
}

// ---- team members (contract-covered routes) ----

export async function listTeamMembers(
  token: string | undefined,
  tenant: string,
  team: string,
  opts?: { q?: string },
): Promise<MemberView[]> {
  const res = await apiFetch<ListMembersResponse>(
    `${tenantPath(tenant)}/teams/${encodeURIComponent(team)}/members${searchQuery(opts?.q)}`,
    { token },
  );
  return res.members ?? [];
}

export async function addTeamMember(
  token: string | undefined,
  tenant: string,
  team: string,
  subject: string,
): Promise<void> {
  const body: AddMemberRequest = { subject };
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/teams/${encodeURIComponent(team)}/members`,
    { token, method: "POST", body },
  );
}

export async function removeTeamMember(
  token: string | undefined,
  tenant: string,
  team: string,
  subject: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/teams/${encodeURIComponent(team)}/members/${encodeURIComponent(subject)}`,
    { token, method: "DELETE" },
  );
}
