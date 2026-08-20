import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";
import type { UiExtensionRemote } from "@/api/extensions";

// Extension RBAC (§5.8): plugin endpoints are protected by the
// `extensions, invoke, <name>` verb. The server exposes the caller's effective
// extension permissions per tenant; the console hides slots the caller may not
// invoke so denied extensions never render.

export interface SelfExtensionPermissions {
  permissions: string[];
}

export async function getSelfExtensionPermissions(
  token: string | undefined,
  tenant: string,
): Promise<string[]> {
  const res = await apiFetch<SelfExtensionPermissions>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/authz/self/extensions`,
    { token },
  );
  return res.permissions;
}

export function canInvokeExtension(
  permissions: string[],
  remote: Pick<UiExtensionRemote, "name" | "requiredPermission">,
): boolean {
  const required = remote.requiredPermission ?? `extensions:invoke:${remote.name}`;
  return permissions.includes(required) || permissions.includes("extensions:invoke:*");
}

export function filterAllowedExtensions<T extends Pick<UiExtensionRemote, "name" | "requiredPermission">>(
  permissions: string[] | null,
  remotes: T[],
): T[] {
  // null = permission list unavailable (endpoint missing); render everything so
  // the console degrades to server-side enforcement rather than hiding slots.
  if (permissions === null) return remotes;
  return remotes.filter((r) => canInvokeExtension(permissions, r));
}
