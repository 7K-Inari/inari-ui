import { apiFetch } from "@/api/client";
import type { CreateDeployRequest, Deploy } from "@/api/types";
import { ALL_TENANTS } from "@/tenant/tenant-link";

function tenantQuery(tenant: string): string {
  return tenant === ALL_TENANTS ? "" : `?tenant=${encodeURIComponent(tenant)}`;
}

export function createDeploy(
  token: string | undefined,
  tenant: string,
  body: CreateDeployRequest,
) {
  return apiFetch<Deploy>(`/deploys${tenantQuery(tenant)}`, { token, method: "POST", body });
}

export function getDeploy(token: string | undefined, id: string) {
  return apiFetch<Deploy>(`/deploys/${encodeURIComponent(id)}`, { token });
}
