import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Cloud account onboarding (§5.7): the platform never holds tenant cloud
// credentials — accounts are connected via an IAM role trusting the platform
// cluster's OIDC provider, validated with a dry-run AssumeRole.

export type CloudAccountStatus = "pending_trust" | "validating" | "connected" | "failed";

export interface CloudAccount {
  id: string;
  tenant: string;
  provider: "aws";
  name: string;
  accountId: string;
  roleArn: string;
  externalId: string;
  regions: string[];
  status: CloudAccountStatus;
  statusMessage: string | null;
  providerConfigName: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
}

export interface TrustSnippet {
  oidcProviderArn: string;
  issuerUrl: string;
  audience: string;
  subject: string;
  externalId: string;
  cloudformation: string;
  terraform: string;
}

export interface CreateCloudAccountRequest {
  provider: "aws";
  name: string;
  accountId: string;
  regions: string[];
}

export interface ValidationResult {
  status: "ok" | "failed";
  message: string;
  providerConfigName: string | null;
  checkedAt: string;
}

export interface ProviderConfig {
  name: string;
  kind: string;
  health: "healthy" | "degraded" | "unknown";
  accountId: string;
  createdAt: string;
}

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function listCloudAccounts(
  token: string | undefined,
  tenant: string,
): Promise<CloudAccount[]> {
  const res = await apiFetch<{ accounts: CloudAccount[] | null }>(
    `${tenantPath(tenant)}/cloud-accounts`,
    { token },
  );
  return res.accounts ?? [];
}

export async function getCloudAccount(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<CloudAccount> {
  const res = await apiFetch<{ account: CloudAccount }>(
    `${tenantPath(resolveTenant(tenant))}/cloud-accounts/${encodeURIComponent(id)}`,
    { token },
  );
  return res.account;
}

export async function createCloudAccount(
  token: string | undefined,
  tenant: string,
  body: CreateCloudAccountRequest,
): Promise<{ account: CloudAccount; trust: TrustSnippet }> {
  return apiFetch<{ account: CloudAccount; trust: TrustSnippet }>(
    `${tenantPath(tenant)}/cloud-accounts`,
    { token, method: "POST", body },
  );
}

export async function getTrustSnippet(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<TrustSnippet> {
  const res = await apiFetch<{ trust: TrustSnippet }>(
    `${tenantPath(resolveTenant(tenant))}/cloud-accounts/${encodeURIComponent(id)}/trust-snippet`,
    { token },
  );
  return res.trust;
}

export async function validateCloudAccount(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<ValidationResult> {
  const res = await apiFetch<{ validation: ValidationResult }>(
    `${tenantPath(resolveTenant(tenant))}/cloud-accounts/${encodeURIComponent(id)}/validate`,
    { token, method: "POST" },
  );
  return res.validation;
}

export async function listProviderConfigs(
  token: string | undefined,
  tenant: string,
): Promise<ProviderConfig[]> {
  const res = await apiFetch<{ providerConfigs: ProviderConfig[] | null }>(
    `${tenantPath(tenant)}/provider-configs`,
    { token },
  );
  return res.providerConfigs ?? [];
}
