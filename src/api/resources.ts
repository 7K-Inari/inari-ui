import { apiFetch } from "@/api/client";
import type { Deploy, ResourceInstanceDetail, ResourceInstanceSummary, UpgradeDiff } from "@/api/types";
import { ALL_TENANTS } from "@/tenant/tenant-link";

function tenantQuery(tenant: string): string {
  return tenant === ALL_TENANTS ? "" : `?tenant=${encodeURIComponent(tenant)}`;
}

export function listResources(token: string | undefined, tenant: string) {
  return apiFetch<ResourceInstanceSummary[]>(`/resources${tenantQuery(tenant)}`, { token });
}

export function getResource(token: string | undefined, id: string) {
  return apiFetch<ResourceInstanceDetail>(`/resources/${encodeURIComponent(id)}`, { token });
}

export function getUpgradeDiff(token: string | undefined, id: string, to: string) {
  return apiFetch<UpgradeDiff>(
    `/resources/${encodeURIComponent(id)}/upgrade-diff?to=${encodeURIComponent(to)}`,
    { token },
  );
}

export function upgradeResource(token: string | undefined, id: string, to: string) {
  return apiFetch<Deploy>(`/resources/${encodeURIComponent(id)}/upgrade`, {
    token,
    method: "POST",
    body: { to },
  });
}
