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

export type Tenant = Organization;

type TenantGitConfig = components["schemas"]["TenantGitConfig"];
export type GitConfigRequest = components["schemas"]["GitConfigInputBody"];

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
