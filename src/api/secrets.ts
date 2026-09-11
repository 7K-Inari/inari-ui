import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Registration tokens: issuing is contract-covered (POST
// /tenants/{org}/clusters/{id}/tokens → TokenOutputBody); listing and
// revocation are proposed huma routes not yet in the pinned contract (1.6.0).
// TODO(contract-sync): drop the local response envelopes once the server
// release lands (npm run sync:api).

export type RegistrationToken = components["schemas"]["RegistrationToken"];
type TokenOutputBody = components["schemas"]["TokenOutputBody"];

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
  const res = await apiFetch<{ tokens: RegistrationToken[] | null }>(
    tokensPath(tenant, clusterId),
    { token },
  );
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

// M6.W4: ESO SecretStore registry (design §3.2). Proposed huma routes not yet
// in the pinned contract; shapes below are mocked by MSW until the W4 server
// release lands.
// TODO(contract-sync): swap for generated schemas after npm run sync:api.
// Credentials are cluster-side k8s Secret references only — the hub never
// accepts raw provider credentials (platform principle 2).

export type SecretStoreProviderType = "awsSM" | "vault" | "gcpsm" | "azurekv";

export interface SecretStoreAuthSecretRef {
  name: string;
  namespace: string;
}

export interface SecretStoreProvider {
  type: SecretStoreProviderType;
  region?: string;
  url?: string;
  projectId?: string;
  authSecretRef: SecretStoreAuthSecretRef;
}

export interface SecretStore {
  name: string;
  orgId: string;
  scope: "platform" | "cluster";
  clusterIds: string[];
  provider: SecretStoreProvider;
  createdAt: string;
}

export interface SecretStoreInput {
  name: string;
  clusterIds: string[];
  provider: SecretStoreProvider;
}

export interface SecretStoreCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface SecretStoreStatus {
  name: string;
  delivered: boolean;
  conditions: SecretStoreCondition[];
}

function storesPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}/secret-stores`;
}

export async function listSecretStores(
  token: string | undefined,
  tenant: string,
): Promise<SecretStore[]> {
  const res = await apiFetch<{ stores: SecretStore[] | null }>(
    storesPath(tenant),
    { token },
  );
  return res.stores ?? [];
}

export async function createSecretStore(
  token: string | undefined,
  tenant: string,
  body: SecretStoreInput,
): Promise<SecretStore> {
  const res = await apiFetch<{ store: SecretStore }>(storesPath(tenant), {
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
  body: SecretStoreInput,
): Promise<SecretStore> {
  const res = await apiFetch<{ store: SecretStore }>(
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
  const res = await apiFetch<{ status: SecretStoreStatus }>(
    `${storesPath(tenant)}/${encodeURIComponent(name)}/status`,
    { token },
  );
  return res.status;
}
