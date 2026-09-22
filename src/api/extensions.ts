import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// UI extension registry (§5.8): remotes are manifest-driven; remoteEntry.js is
// served by the backend from OCI artifacts. The shell registers them at
// runtime via @module-federation/runtime.

export type SlotKind =
  | "nav-item"
  | "catalog-card"
  | "cluster-tab"
  | "instance-action"
  | "form-widget"
  | "page";

export interface UiExtensionSlotDescriptor {
  kind: SlotKind;
  name: string;
}

export interface UiExtensionRemote {
  name: string;
  version: string;
  title?: string;
  description?: string;
  remoteEntryUrl: string;
  slots: UiExtensionSlotDescriptor[];
  // Extension RBAC verb: `extensions, invoke, <name>` (§5.8). Absent means the
  // extension is invokable by anyone who can see the tenant.
  requiredPermission?: string;
  enabled: boolean;
}

export interface BackendExtension {
  name: string;
  version: string;
  description?: string;
  healthy: boolean;
}

// Raw registry record (§5.8): the API exposes `state`
// (pending|ready|degraded|stopped); there is no `healthy` field.
interface BackendExtensionRecord {
  name: string;
  version: string;
  description?: string;
  state?: string;
}

export async function listUiExtensions(
  token: string | undefined,
  tenant: string,
): Promise<UiExtensionRemote[]> {
  const res = await apiFetch<{ extensions: UiExtensionRemote[] }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions/ui`,
    { token },
  );
  return res.extensions;
}

export async function addUiExtension(
  token: string | undefined,
  tenant: string,
  input: { name: string; remoteEntryUrl: string },
): Promise<UiExtensionRemote> {
  const res = await apiFetch<{ extension: UiExtensionRemote }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions/ui`,
    { token, method: "POST", body: input },
  );
  return res.extension;
}

export async function removeUiExtension(
  token: string | undefined,
  tenant: string,
  name: string,
): Promise<void> {
  await apiFetch(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions/ui/${encodeURIComponent(name)}`,
    { token, method: "DELETE" },
  );
}

export async function listBackendExtensions(
  token: string | undefined,
  tenant: string,
): Promise<BackendExtension[]> {
  const res = await apiFetch<{ extensions: BackendExtensionRecord[] }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions`,
    { token },
  );
  // Project registry state onto the badge: ready = healthy, anything else
  // (pending/degraded/stopped) = unhealthy.
  return (res.extensions ?? []).map((e) => ({
    name: e.name,
    version: e.version,
    description: e.description,
    healthy: e.state === "ready",
  }));
}
