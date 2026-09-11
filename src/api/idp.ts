import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// M6.W6: IdP brokering + login-routing domains (Settings §3.3).
// TODO(contract-sync): these routes are not yet in the pinned contract
// (openapi/openapi.yaml); shapes below are proposed wire shapes mocked by MSW.
// Swap for generated schemas after npm run sync:api.

// M6.W8: SAML joins OIDC in the reserved provider union.
export type IdpProviderKind = "oidc" | "saml";

export interface OidcProvider {
  provider: "oidc";
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

export type IdpProvider = OidcProvider | SamlProvider;

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

export type IdpProviderInput = OidcProviderInput | SamlProviderInput;

// ---- SAML (M6.W8) ----

// SAML IdPs have no discovery URL: configuration comes from metadata XML
// import (import-config) or manual entityID/SSO URL/certificate entry.
export interface SamlProvider {
  provider: "saml";
  alias: string;
  entityId: string;
  // Single sign-on service URL (redirect binding).
  ssoUrl: string;
  nameIdFormat: string;
  // IdP signing certificate (PEM). Public key material — safe to return.
  signingCertificate?: string;
  certExpiresAt?: string;
  wantAuthnRequestsSigned: boolean;
  wantAssertionsSigned: boolean;
  claimMapping: { email: string; groups: string };
  domainHints: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SamlProviderInput {
  provider: "saml";
  alias: string;
  entityId: string;
  ssoUrl: string;
  nameIdFormat?: string;
  // PEM; accepted on create/edit and via the certificate upload endpoint.
  signingCertificate?: string;
  wantAuthnRequestsSigned?: boolean;
  wantAssertionsSigned?: boolean;
  claimMapping: { email: string; groups: string };
  domainHints: string[];
}

// Result of importing IdP metadata (KC import-config equivalent): the server
// parses the XML (or fetches metadataUrl) and returns the extracted config.
export interface SamlMetadataImport {
  entityId: string;
  ssoUrl: string;
  nameIdFormat?: string;
  signingCertificate?: string;
}

// POST /identity/provider/import-config — parse SAML metadata into config.
export async function importIdpMetadata(
  token: string | undefined,
  tenant: string,
  body: { metadataUrl?: string; metadataXml?: string },
): Promise<SamlMetadataImport> {
  const res = await apiFetch<{ config: SamlMetadataImport }>(
    `${tenantPath(tenant)}/identity/provider/import-config`,
    { token, method: "POST", body },
  );
  return res.config;
}

// POST /identity/provider/certificate — upload/rotate the IdP signing
// certificate (PEM). Returns the updated provider with cert expiry.
export async function uploadIdpCertificate(
  token: string | undefined,
  tenant: string,
  certificate: string,
): Promise<IdpProvider> {
  const res = await apiFetch<{ provider: IdpProvider }>(
    `${tenantPath(tenant)}/identity/provider/certificate`,
    { token, method: "POST", body: { certificate } },
  );
  return res.provider;
}

// GET /identity/provider/export — SP descriptor XML tenants hand to their IdP
// to configure the Inari side. Fetched with the bearer token (a plain anchor
// navigation would not authenticate), then offered as a blob download.
export async function exportSpDescriptor(
  token: string | undefined,
  tenant: string,
): Promise<string> {
  return apiFetch<string>(`${tenantPath(tenant)}/identity/provider/export`, {
    token,
  });
}

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
