import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Runtime feature flags (kill-switch v2, ADR-0016): platform-scoped defaults
// (platform admins) and per-cluster overrides (tenant admin/operator).
// Server shapes come from the huma-generated OpenAPI contract.
export type FeatureFlag = components["schemas"]["FlagView"];
type ListFlagsOutputBody = components["schemas"]["ListFlagsOutputBody"];
type SetFlagInputBody = components["schemas"]["SetFlagInputBody"];

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

export async function listPlatformFeatureFlags(
  token: string | undefined,
): Promise<FeatureFlag[]> {
  const res = await apiFetch<ListFlagsOutputBody>(`/platform/feature-flags`, { token });
  return res.flags ?? [];
}

export async function setPlatformFeatureFlag(
  token: string | undefined,
  key: string,
  value: boolean,
): Promise<void> {
  await apiFetch<unknown>(`/platform/feature-flags/${encodeURIComponent(key)}`, {
    token,
    method: "PUT",
    body: { value } satisfies SetFlagInputBody,
  });
}

export async function clearPlatformFeatureFlag(
  token: string | undefined,
  key: string,
): Promise<void> {
  await apiFetch<unknown>(`/platform/feature-flags/${encodeURIComponent(key)}`, {
    token,
    method: "DELETE",
  });
}

export async function listClusterFeatureFlags(
  token: string | undefined,
  clusterId: string,
  tenant?: string,
): Promise<FeatureFlag[]> {
  const t = resolveTenant(tenant);
  const res = await apiFetch<ListFlagsOutputBody>(
    `${tenantPath(t)}/clusters/${encodeURIComponent(clusterId)}/feature-flags`,
    { token },
  );
  return res.flags ?? [];
}

export async function setClusterFeatureFlag(
  token: string | undefined,
  clusterId: string,
  key: string,
  value: boolean,
  tenant?: string,
): Promise<void> {
  const t = resolveTenant(tenant);
  await apiFetch<unknown>(
    `${tenantPath(t)}/clusters/${encodeURIComponent(clusterId)}/feature-flags/${encodeURIComponent(key)}`,
    { token, method: "PUT", body: { value } satisfies SetFlagInputBody },
  );
}

export async function clearClusterFeatureFlag(
  token: string | undefined,
  clusterId: string,
  key: string,
  tenant?: string,
): Promise<void> {
  const t = resolveTenant(tenant);
  await apiFetch<unknown>(
    `${tenantPath(t)}/clusters/${encodeURIComponent(clusterId)}/feature-flags/${encodeURIComponent(key)}`,
    { token, method: "DELETE" },
  );
}
