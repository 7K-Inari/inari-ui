import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Platform resources (M5 operator sunset Phase 1): with the server-side
// render cutover (platform_resources.gitops_render flag), these rows are
// backed by native resources rendered into GitOps state repos via the
// source-agnostic renderer — a native ExternalDNS DNSEndpoint for the DNS
// row, a KRO tenantnamespace instance for the namespace row, and
// provider-keycloak TenantRealm/TenantClient claims for the Keycloak rows —
// replacing the inari-operator facade CRDs (platform.inari.io). The row
// vocabulary itself is unchanged: the new rendered GVRs fold status onto
// the same rows (contract pinned with W2-2).
//
// cert-manager ClusterIssuers and ArgoCD AppProjects are committed to the
// state repos as native manifests but are not tracked as rows; the backing
// addons (cert-manager, ExternalDNS, ArgoCD) are installed and managed from
// the cluster addons page — see platformResourceKindInfo below.

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

// Management surface for a platform resource kind: which first-class addon
// (cluster addons page) owns the backing controller, "kro" for the
// tenantnamespace RGD instance, or "platform" for hub-side rows. Addon names
// match the catalog item names (W2-1 catalog entries).
export type PlatformResourceManagement =
  | { type: "addon"; addon: string }
  | { type: "kro" }
  | { type: "platform" };

const KIND_INFO: Record<
  PlatformResourceKind,
  { label: string; management: PlatformResourceManagement }
> = {
  // Rendered as a native ExternalDNS DNSEndpoint (render cutover).
  "dns-zone": { label: "DNSEndpoint", management: { type: "addon", addon: "external-dns" } },
  // Rendered as a KRO tenantnamespace RGD instance (stacks.inari.io/v1alpha1).
  "tenant-namespace": { label: "Tenant namespace", management: { type: "kro" } },
  // Hub-side provider-keycloak TenantRealm/TenantClient claims.
  "keycloak-realm": { label: "Keycloak realm", management: { type: "platform" } },
  "keycloak-client": { label: "Keycloak client", management: { type: "platform" } },
};

// platformResourceKindInfo resolves display metadata for a platform resource
// kind. Unknown kinds (contract types kind as a plain string) fall back to
// the raw value with no management hint.
export function platformResourceKindInfo(
  kind: string,
): { label: string; management: PlatformResourceManagement | null } {
  const info = KIND_INFO[kind as PlatformResourceKind];
  return info ?? { label: kind, management: null };
}

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
