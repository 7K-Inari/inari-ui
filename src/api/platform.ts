import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Platform page: apps running on the platform cluster (catalog source
// "platform") plus per-tenant platform resources (Keycloak realm/clients, DNS
// zone, tenant namespaces) reconciled by inari-operator.

export type PlatformResourceKind =
  | "keycloak-realm"
  | "keycloak-client"
  | "dns-zone"
  | "tenant-namespace";

export type PlatformResourceStatus = "ready" | "reconciling" | "failed";

export interface TenantPlatformResource {
  id: string;
  tenant: string;
  kind: PlatformResourceKind;
  name: string;
  status: PlatformResourceStatus;
  detail: string;
  updatedAt: string;
}

export async function listTenantPlatformResources(
  token: string | undefined,
  tenant: string,
): Promise<TenantPlatformResource[]> {
  const res = await apiFetch<{ resources: TenantPlatformResource[] | null }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/platform-resources`,
    { token },
  );
  return res.resources ?? [];
}
