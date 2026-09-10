import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// M6.W3: identity settings REST surface (inari-server, huma).
// TODO(contract-sync): these routes are not yet in the pinned contract
// (openapi/openapi.yaml); shapes below are proposed wire shapes mocked by MSW.
// Swap for generated schemas after npm run sync:api.

export interface OidcClient {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  redirectUris: string[];
  grantTypes: string[];
  isPublic: boolean;
  scopes: string[];
  createdAt: string;
}

export interface OidcScope {
  name: string;
  description: string;
  audience?: string;
}

export interface OidcClientInput {
  name: string;
  description?: string;
  redirectUris: string[];
  grantTypes: string[];
  isPublic: boolean;
}

// One-time secret: returned only on create/rotate, never retrievable again.
export interface ClientSecret {
  clientId: string;
  secret: string;
  expiresAt?: string;
}

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function listOidcClients(
  token: string | undefined,
  tenant: string,
): Promise<OidcClient[]> {
  const res = await apiFetch<{ clients: OidcClient[] | null }>(
    `${tenantPath(tenant)}/identity/clients`,
    { token },
  );
  return res.clients ?? [];
}

export async function createOidcClient(
  token: string | undefined,
  tenant: string,
  body: OidcClientInput,
): Promise<{ client: OidcClient; secret: ClientSecret | null }> {
  const res = await apiFetch<{ client: OidcClient; secret?: ClientSecret }>(
    `${tenantPath(tenant)}/identity/clients`,
    { token, method: "POST", body },
  );
  return { client: res.client, secret: res.secret ?? null };
}

export async function updateOidcClient(
  token: string | undefined,
  tenant: string,
  id: string,
  body: OidcClientInput,
): Promise<OidcClient> {
  const res = await apiFetch<{ client: OidcClient }>(
    `${tenantPath(tenant)}/identity/clients/${encodeURIComponent(id)}`,
    { token, method: "PUT", body },
  );
  return res.client;
}

export async function deleteOidcClient(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/identity/clients/${encodeURIComponent(id)}`,
    { token, method: "DELETE" },
  );
}

export async function rotateClientSecret(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<ClientSecret> {
  const res = await apiFetch<{ secret: ClientSecret }>(
    `${tenantPath(tenant)}/identity/clients/${encodeURIComponent(id)}/secret:rotate`,
    { token, method: "POST" },
  );
  return res.secret;
}

export async function listOidcScopes(
  token: string | undefined,
  tenant: string,
): Promise<OidcScope[]> {
  const res = await apiFetch<{ scopes: OidcScope[] | null }>(
    `${tenantPath(tenant)}/identity/scopes`,
    { token },
  );
  return res.scopes ?? [];
}

export async function putClientScopes(
  token: string | undefined,
  tenant: string,
  id: string,
  scopes: string[],
): Promise<OidcClient> {
  const res = await apiFetch<{ client: OidcClient }>(
    `${tenantPath(tenant)}/identity/clients/${encodeURIComponent(id)}/scopes`,
    { token, method: "PUT", body: { scopes } },
  );
  return res.client;
}
