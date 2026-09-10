import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// M6.W6: IdP brokering + login-routing domains (Settings §3.3).
// TODO(contract-sync): these routes are not yet in the pinned contract
// (openapi/openapi.yaml); shapes below are proposed wire shapes mocked by MSW.
// Swap for generated schemas after npm run sync:api.

// v1 is OIDC-only, but the provider field is a discriminated union so SAML can
// be added later without redesign.
export type IdpProviderKind = "oidc";

export interface OidcProvider {
  provider: IdpProviderKind;
  alias: string;
  issuerUrl: string;
  clientId: string;
  // Server-side marker only: the client secret is write-only and is never
  // returned by the API.
  secretConfigured: boolean;
  claimMapping: { email: string; groups: string };
  // Tenant email domains used for login routing (exact or "*.tld" wildcard).
  domainHints: string[];
  createdAt: string;
  updatedAt: string;
}

export type IdpProvider = OidcProvider;

export interface OidcProviderInput {
  provider: "oidc";
  alias: string;
  issuerUrl: string;
  clientId: string;
  // Write-only: accepted on create; rotation goes through :rotate.
  clientSecret?: string;
  claimMapping: { email: string; groups: string };
  domainHints: string[];
}

export type IdpProviderInput = OidcProviderInput;

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function getIdentityProvider(
  token: string | undefined,
  tenant: string,
): Promise<IdpProvider | null> {
  const res = await apiFetch<{ provider: IdpProvider | null }>(
    `${tenantPath(tenant)}/identity/provider`,
    { token },
  );
  return res.provider ?? null;
}

// Create-or-replace: the server enforces one IdP per org.
export async function putIdentityProvider(
  token: string | undefined,
  tenant: string,
  body: IdpProviderInput,
): Promise<IdpProvider> {
  const res = await apiFetch<{ provider: IdpProvider }>(
    `${tenantPath(tenant)}/identity/provider`,
    { token, method: "PUT", body },
  );
  return res.provider;
}

// Rotates the write-only client secret. The new secret is never returned; the
// provider just keeps reporting secretConfigured.
export async function rotateProviderSecret(
  token: string | undefined,
  tenant: string,
  clientSecret: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/identity/provider/secret:rotate`,
    { token, method: "POST", body: { clientSecret } },
  );
}

export async function deleteIdentityProvider(
  token: string | undefined,
  tenant: string,
): Promise<void> {
  await apiFetch<unknown>(`${tenantPath(tenant)}/identity/provider`, {
    token,
    method: "DELETE",
  });
}

// Replaces the provider's domain hints. The server answers 409 when a domain
// is already claimed by another organization.
export async function putDomainHints(
  token: string | undefined,
  tenant: string,
  domainHints: string[],
): Promise<IdpProvider> {
  const res = await apiFetch<{ provider: IdpProvider }>(
    `${tenantPath(tenant)}/identity/provider/domains`,
    { token, method: "PUT", body: { domainHints } },
  );
  return res.provider;
}
