import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";

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
