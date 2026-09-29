import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Identity settings REST surface (inari-server, huma). Shapes match the
// implemented server contract (inari-server internal/types IdentityClient,
// internal/tenancy/identity_http.go) — verified live 2026-09-28.

export type OidcClientType = "service" | "public";

export interface OidcClient {
  clientId: string;
  name: string;
  type: OidcClientType;
  audiences: string[];
  scopes: string[];
  redirectUris?: string[];
  status: "active" | "disabled";
  createdAt: string;
}

export interface OidcScope {
  audience: string;
  scopes: string[];
}

export interface OidcClientInput {
  name: string;
  type: OidcClientType;
  audiences: string[];
  scopes: string[];
  redirectUris: string[];
}

// One-time secret: returned only on create/rotate, never retrievable again.
export interface ClientSecret {
  clientId: string;
  secret: string;
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
  const res = await apiFetch<{ client: OidcClient; secret?: string }>(
    `${tenantPath(tenant)}/identity/clients`,
    { token, method: "POST", body },
  );
  return {
    client: res.client,
    secret: res.secret ? { clientId: res.client.clientId, secret: res.secret } : null,
  };
}

export async function updateOidcClient(
  token: string | undefined,
  tenant: string,
  clientId: string,
  body: OidcClientInput,
): Promise<OidcClient> {
  const res = await apiFetch<{ client: OidcClient }>(
    `${tenantPath(tenant)}/identity/clients/${encodeURIComponent(clientId)}`,
    {
      token,
      method: "PATCH",
      body: {
        name: body.name,
        audiences: body.audiences,
        scopes: body.scopes,
        redirectUris: body.redirectUris,
      },
    },
  );
  return res.client;
}

export async function deleteOidcClient(
  token: string | undefined,
  tenant: string,
  clientId: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/identity/clients/${encodeURIComponent(clientId)}`,
    { token, method: "DELETE" },
  );
}

export async function rotateClientSecret(
  token: string | undefined,
  tenant: string,
  clientId: string,
): Promise<ClientSecret> {
  const res = await apiFetch<{ secret: string }>(
    `${tenantPath(tenant)}/identity/clients/${encodeURIComponent(clientId)}/secret:rotate`,
    { token, method: "POST" },
  );
  return { clientId, secret: res.secret };
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
  clientId: string,
  scopes: string[],
): Promise<OidcClient> {
  const res = await apiFetch<{ client: OidcClient }>(
    `${tenantPath(tenant)}/identity/clients/${encodeURIComponent(clientId)}/scopes`,
    { token, method: "PUT", body: { scopes } },
  );
  return res.client;
}
