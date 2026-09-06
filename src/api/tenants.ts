import { apiFetch } from "@/api/client";

// Organization (tenant) creation is a platform-scoped operation: unlike other
// helpers it is not nested under /tenants/{org}/... (§5, §11/6).

// Mirrors the server's types.Organization (inari-server tenancy module).
export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  keycloakOrgId?: string;
  createdAt?: string;
}

export interface CreateTenantRequest {
  slug: string;
  displayName: string;
}

export async function createTenant(
  token: string | undefined,
  body: CreateTenantRequest,
): Promise<Tenant> {
  const res = await apiFetch<{ organization: Tenant }>(`/tenants`, {
    token,
    method: "POST",
    body,
  });
  return res.organization;
}
