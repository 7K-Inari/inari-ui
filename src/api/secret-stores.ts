import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// ESO SecretStore registry (design §3.2), typed from the generated OpenAPI
// contract. Credentials are cluster-side k8s Secret references only — the hub
// never accepts raw provider credentials (platform principle 2), so this API
// surface is reference-only and never returns secret values.

export type SecretStore = components["schemas"]["SecretStore"];
export type SecretStoreProvider = components["schemas"]["SecretStoreProvider"];
export type SecretStoreTargets = components["schemas"]["SecretStoreTargets"];
export type SecretStoreCondition = components["schemas"]["SecretStoreCondition"];
export type SecretStoreStatus = components["schemas"]["SecretStoreStatus"];
export type CreateSecretStoreInput = components["schemas"]["CreateInputBody1"];
export type UpdateSecretStoreInput = components["schemas"]["UpdateInputBody1"];

type ListOutputBody = components["schemas"]["ListOutputBody4"];
type StoreOutputBody = components["schemas"]["StoreOutputBody"];
type StatusOutputBody = components["schemas"]["StatusOutputBody"];

export const SECRET_STORE_PROVIDER_KEYS = [
  "awsSM",
  "vault",
  "gcpsm",
  "azurekv",
] as const satisfies readonly (keyof SecretStoreProvider)[];

export type SecretStoreProviderKey = (typeof SECRET_STORE_PROVIDER_KEYS)[number];

export function secretStoreProviderKey(
  provider: SecretStoreProvider,
): SecretStoreProviderKey | null {
  return (
    SECRET_STORE_PROVIDER_KEYS.find((key) => provider[key] !== undefined) ?? null
  );
}

function storesPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}/secret-stores`;
}

function storePath(tenant: string, name: string): string {
  return `${storesPath(tenant)}/${encodeURIComponent(name)}`;
}

export async function listSecretStores(
  token: string | undefined,
  tenant: string,
): Promise<SecretStore[]> {
  const res = await apiFetch<ListOutputBody>(storesPath(tenant), { token });
  return res.stores ?? [];
}

export async function getSecretStore(
  token: string | undefined,
  tenant: string,
  name: string,
): Promise<SecretStore> {
  const res = await apiFetch<StoreOutputBody>(storePath(tenant, name), {
    token,
  });
  return res.store;
}

export async function createSecretStore(
  token: string | undefined,
  tenant: string,
  body: CreateSecretStoreInput,
): Promise<SecretStore> {
  const res = await apiFetch<StoreOutputBody>(storesPath(tenant), {
    token,
    method: "POST",
    body,
  });
  return res.store;
}

export async function updateSecretStore(
  token: string | undefined,
  tenant: string,
  name: string,
  body: UpdateSecretStoreInput,
): Promise<SecretStore> {
  const res = await apiFetch<StoreOutputBody>(storePath(tenant, name), {
    token,
    method: "PATCH",
    body,
  });
  return res.store;
}

export async function deleteSecretStore(
  token: string | undefined,
  tenant: string,
  name: string,
): Promise<void> {
  await apiFetch<unknown>(storePath(tenant, name), {
    token,
    method: "DELETE",
  });
}

export async function getSecretStoreStatus(
  token: string | undefined,
  tenant: string,
  name: string,
): Promise<SecretStoreStatus> {
  const res = await apiFetch<StatusOutputBody>(
    `${storePath(tenant, name)}/status`,
    { token },
  );
  return res.status;
}
