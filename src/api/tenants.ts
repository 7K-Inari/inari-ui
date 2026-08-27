import { apiFetch } from "@/api/client";

// Organization (tenant) creation is a platform-scoped operation: unlike other
// helpers it is not nested under /tenants/{org}/... (§5, §11/6).

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  createdAt?: string;
}

export interface CreateTenantRequest {
  slug: string;
  name: string;
}

export async function createTenant(
  token: string | undefined,
  body: CreateTenantRequest,
): Promise<Tenant> {
  const res = await apiFetch<{ tenant: Tenant }>(`/tenants`, {
    token,
    method: "POST",
    body,
  });
  return res.tenant;
}
