import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// UI extension registry (§5.8): remotes are manifest-driven; remoteEntry.js is
// served by the backend from OCI artifacts. The shell registers them at
// runtime via @module-federation/runtime.
//
// Wire shapes come from the huma-generated OpenAPI contract
// (src/api/__generated__/schema.ts); the UiExtensionRemote/SlotKind types
// below are UI view models (`/extensions/ui` is a UI-specific projection).

type WireUiExtensionRemote = components["schemas"]["UiExtensionRemote"];
type WireListUiExtensionsResponse = components["schemas"]["ListUiOutputBody"];
type WireUiExtensionResponse = components["schemas"]["UiExtensionOutputBody"];
type WireRegisterUiExtensionInput = components["schemas"]["RegisterUiInputBody"];
type WireExtension = components["schemas"]["Extension"];
type WireListExtensionsResponse = components["schemas"]["ListOutputBody5"];
type WireRotateIdentityResponse = components["schemas"]["RotateIdentityOutputBody"];

// One-time gateway identity secret returned by identity rotation (ADR-0008).
export type ExtensionCredentials = components["schemas"]["ExtensionCredentials"];

export type SlotKind =
  | "nav-item"
  | "catalog-card"
  | "cluster-tab"
  | "instance-action"
  | "form-widget"
  | "page";

export interface UiExtensionSlotViewModel {
  kind: SlotKind;
  name: string;
}

export interface UiExtensionRemoteViewModel {
  name: string;
  version: string;
  title?: string;
  description?: string;
  remoteEntryUrl: string;
  slots: UiExtensionSlotViewModel[];
  // Extension RBAC verb: `extensions, invoke, <name>` (§5.8). Absent means the
  // extension is invokable by anyone who can see the tenant.
  requiredPermission?: string;
  enabled: boolean;
}

function toRemoteViewModel(w: WireUiExtensionRemote): UiExtensionRemoteViewModel {
  return {
    name: w.name,
    version: w.version,
    title: w.title,
    description: w.description,
    remoteEntryUrl: w.remoteEntryUrl,
    slots: (w.slots ?? []).map((s) => ({ kind: s.kind as SlotKind, name: s.name })),
    requiredPermission: w.requiredPermission,
    enabled: w.enabled,
  };
}

// Backend extension view model: the wire record exposes `state`
// (pending|ready|degraded|stopped); `healthy` is the UI projection
// (ready = healthy, anything else = unhealthy).
export interface BackendExtensionViewModel {
  id: string;
  name: string;
  version: string;
  kind: string;
  state: string;
  healthy: boolean;
}

function toBackendViewModel(e: WireExtension): BackendExtensionViewModel {
  return {
    id: e.id,
    name: e.name,
    version: e.version,
    kind: e.kind,
    state: e.state,
    healthy: e.state === "ready",
  };
}

export async function listUiExtensions(
  token: string | undefined,
  tenant: string,
): Promise<UiExtensionRemoteViewModel[]> {
  const res = await apiFetch<WireListUiExtensionsResponse>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions/ui`,
    { token },
  );
  return (res.extensions ?? []).map(toRemoteViewModel);
}

export async function addUiExtension(
  token: string | undefined,
  tenant: string,
  input: Pick<WireRegisterUiExtensionInput, "name" | "remoteEntryUrl">,
): Promise<UiExtensionRemoteViewModel> {
  const res = await apiFetch<WireUiExtensionResponse>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions/ui`,
    { token, method: "POST", body: input },
  );
  return toRemoteViewModel(res.extension);
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
): Promise<BackendExtensionViewModel[]> {
  const res = await apiFetch<WireListExtensionsResponse>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions`,
    { token },
  );
  return (res.extensions ?? []).map(toBackendViewModel);
}

// Rotates the extension's gateway identity secret. The new secret is returned
// exactly once — callers must surface it to the user immediately.
export async function rotateExtensionIdentity(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<ExtensionCredentials> {
  const res = await apiFetch<WireRotateIdentityResponse>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/extensions/${encodeURIComponent(id)}/identity/rotate`,
    { token, method: "POST" },
  );
  return res.credentials;
}
