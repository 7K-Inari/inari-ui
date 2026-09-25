import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// M6.W6: IdP brokering + login-routing domains (Settings §3.3). The contract
// covers OIDC only; one provider per organization.

export type OidcProvider = components["schemas"]["BrokeredIdP"];
export type OidcProviderInput = components["schemas"]["PutProviderCompatInputBody"];
type ProviderCompatOutputBody = components["schemas"]["ProviderCompatOutputBody"];
type PutProviderDomainsInputBody =
  components["schemas"]["PutProviderDomainsInputBody"];
type RotateProviderSecretInputBody =
  components["schemas"]["RotateProviderSecretInputBody"];

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function getIdentityProvider(
  token: string | undefined,
  tenant: string,
): Promise<OidcProvider | null> {
  const res = await apiFetch<ProviderCompatOutputBody>(
    `${tenantPath(tenant)}/identity/provider`,
    { token },
  );
  // The server answers with provider null when none is configured.
  return res.provider ?? null;
}

// Create-or-replace: the server enforces one IdP per org.
export async function putIdentityProvider(
  token: string | undefined,
  tenant: string,
  body: OidcProviderInput,
): Promise<OidcProvider> {
  const res = await apiFetch<ProviderCompatOutputBody>(
    `${tenantPath(tenant)}/identity/provider`,
    { token, method: "PUT", body },
  );
  return res.provider;
}

// Rotates the write-only client secret. The new secret is never returned.
export async function rotateProviderSecret(
  token: string | undefined,
  tenant: string,
  clientSecret: string,
): Promise<void> {
  const body: RotateProviderSecretInputBody = { clientSecret };
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/identity/provider/secret:rotate`,
    { token, method: "POST", body },
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
): Promise<OidcProvider> {
  const body: PutProviderDomainsInputBody = { domainHints };
  const res = await apiFetch<ProviderCompatOutputBody>(
    `${tenantPath(tenant)}/identity/provider/domains`,
    { token, method: "PUT", body },
  );
  return res.provider;
}
