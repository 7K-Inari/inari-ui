import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

export type RegistrationToken = components["schemas"]["RegistrationToken"];
type TokenOutputBody = components["schemas"]["TokenOutputBody"];
type ListTokensOutputBody = components["schemas"]["ListTokensOutputBody"];

export type IssuedToken = TokenOutputBody;

function tokensPath(tenant: string, clusterId: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}/clusters/${encodeURIComponent(clusterId)}/tokens`;
}

export async function issueRegistrationToken(
  token: string | undefined,
  tenant: string,
  clusterId: string,
): Promise<IssuedToken> {
  return apiFetch<TokenOutputBody>(tokensPath(tenant, clusterId), {
    token,
    method: "POST",
  });
}

export async function listRegistrationTokens(
  token: string | undefined,
  tenant: string,
  clusterId: string,
): Promise<RegistrationToken[]> {
  const res = await apiFetch<ListTokensOutputBody>(tokensPath(tenant, clusterId), {
    token,
  });
  return res.tokens ?? [];
}

export async function revokeRegistrationToken(
  token: string | undefined,
  tenant: string,
  clusterId: string,
  tokenId: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tokensPath(tenant, clusterId)}/${encodeURIComponent(tokenId)}`,
    { token, method: "DELETE" },
  );
}

// M6.W4: ESO SecretStore registry (design §3.2). Credentials are cluster-side
// k8s Secret references only — the hub never accepts raw provider credentials
// (platform principle 2).

export type SecretStore = components["schemas"]["SecretStore"];
export type SecretStoreProvider = components["schemas"]["SecretStoreProvider"];
export type SecretStoreTargets = components["schemas"]["SecretStoreTargets"];
export type SecretStoreStatus = components["schemas"]["SecretStoreStatus"];
export type SecretStoreCondition = components["schemas"]["SecretStoreCondition"];
export type SecretStoreAuthSecretRef = components["schemas"]["SecretRef"];
type CreateStoreInputBody = components["schemas"]["CreateInputBody1"];
type UpdateStoreInputBody = components["schemas"]["UpdateInputBody1"];
type ListStoresOutputBody = components["schemas"]["ListOutputBody4"];
type StoreOutputBody = components["schemas"]["StoreOutputBody"];
type StatusOutputBody = components["schemas"]["StatusOutputBody"];

// UI-known literal sets; the contract types scope as a plain string.
export type SecretStoreScope = "platform" | "cluster";
export type SecretStoreProviderType = "awsSM" | "vault" | "gcpsm" | "azurekv";

// Create payload view model: the page composes a full store definition; the
// adapter maps it onto CreateInputBody1.
export interface SecretStoreInput {
  name: string;
  scope: SecretStoreScope;
  clusterIds: string[];
  provider: SecretStoreProvider;
}

export function secretStoreProviderType(
  provider: SecretStoreProvider,
): SecretStoreProviderType | undefined {
  if (provider.awsSM) return "awsSM";
  if (provider.vault) return "vault";
  if (provider.gcpsm) return "gcpsm";
  if (provider.azurekv) return "azurekv";
  return undefined;
}

function storesPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}/secret-stores`;
}

export async function listSecretStores(
  token: string | undefined,
  tenant: string,
): Promise<SecretStore[]> {
  const res = await apiFetch<ListStoresOutputBody>(storesPath(tenant), {
    token,
  });
  return res.stores ?? [];
}

export async function createSecretStore(
  token: string | undefined,
  tenant: string,
  input: SecretStoreInput,
): Promise<SecretStore> {
  const body: CreateStoreInputBody = {
    name: input.name,
    scope: input.scope,
    provider: input.provider,
    targets: { clusterIds: input.clusterIds },
  };
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
  input: SecretStoreInput,
): Promise<SecretStore> {
  const body: UpdateStoreInputBody = {
    provider: input.provider,
    targets: { clusterIds: input.clusterIds },
  };
  const res = await apiFetch<StoreOutputBody>(
    `${storesPath(tenant)}/${encodeURIComponent(name)}`,
    { token, method: "PATCH", body },
  );
  return res.store;
}

export async function deleteSecretStore(
  token: string | undefined,
  tenant: string,
  name: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${storesPath(tenant)}/${encodeURIComponent(name)}`,
    { token, method: "DELETE" },
  );
}

export async function getSecretStoreStatus(
  token: string | undefined,
  tenant: string,
  name: string,
): Promise<SecretStoreStatus> {
  const res = await apiFetch<StatusOutputBody>(
    `${storesPath(tenant)}/${encodeURIComponent(name)}/status`,
    { token },
  );
  return res.status;
}
