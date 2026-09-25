import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Platform page: apps running on the platform cluster (catalog source
// "platform") plus per-tenant platform resources (Keycloak realm/clients, DNS
// zone, tenant namespaces) reconciled by inari-operator.

export type TenantPlatformResource = components["schemas"]["ResourceView"];
type ListResourcesOutputBody = components["schemas"]["ListOutputBody2"];

// UI-known literal sets. The contract types kind/status as plain strings, so
// pages must fall back gracefully on values outside these unions.
export type PlatformResourceKind =
  | "keycloak-realm"
  | "keycloak-client"
  | "dns-zone"
  | "tenant-namespace";

export type PlatformResourceStatus = "ready" | "reconciling" | "failed";

export async function listTenantPlatformResources(
  token: string | undefined,
  tenant: string,
): Promise<TenantPlatformResource[]> {
  const res = await apiFetch<ListResourcesOutputBody>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/platform-resources`,
    { token },
  );
  return res.resources ?? [];
}
