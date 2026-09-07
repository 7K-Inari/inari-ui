import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Cloud account onboarding (§5.7): the platform never holds tenant cloud
// credentials — accounts are connected via an IAM role trusting the platform
// cluster's OIDC provider, validated with a dry-run AssumeRole.
// All server shapes come from the huma-generated OpenAPI contract (pinned
// snapshot in openapi/openapi.yaml); the view models below only carry the
// fields that contract actually provides (CloudAccount, RegisterInputBody,
// AccountOutputBody, renderCloudAccountProviderConfig, validateCloudAccount).

export type CloudAccountStatus = "pending_trust" | "validating" | "connected" | "failed";

export interface CloudAccount {
  id: string;
  tenant: string;
  provider: "aws";
  accountId: string;
  roleArn: string;
  externalId: string;
  issuerUrl: string | null;
  status: CloudAccountStatus;
  statusMessage: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
}

// POST /tenants/{org}/cloud-accounts body (RegisterInputBody in the contract).
export interface CreateCloudAccountRequest {
  accountId: string;
  roleArn: string;
  externalId?: string;
  issuerUrl?: string;
  provider?: string;
  runContext?: string;
}

type ServerCloudAccount = components["schemas"]["CloudAccount"];
type ListAccountsResponse = components["schemas"]["ListAccountsOutputBody"];
type AccountResponse = components["schemas"]["AccountOutputBody"];

function mapCloudAccount(a: ServerCloudAccount): CloudAccount {
  return {
    id: a.id,
    tenant: a.orgId,
    provider: a.provider as "aws",
    accountId: a.accountId,
    roleArn: a.roleArn,
    externalId: a.externalId ?? "",
    issuerUrl: a.issuerUrl ?? null,
    status: a.state as CloudAccountStatus,
    statusMessage: a.validationError ?? null,
    lastValidatedAt: a.validatedAt ?? null,
    createdAt: a.createdAt,
  };
}

function tenantPath(tenant?: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function listCloudAccounts(
  token: string | undefined,
  tenant: string,
): Promise<CloudAccount[]> {
  const res = await apiFetch<ListAccountsResponse>(
    `${tenantPath(tenant)}/cloud-accounts`,
    { token },
  );
  return (res.accounts ?? []).map(mapCloudAccount);
}

export async function getCloudAccount(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<CloudAccount> {
  const res = await apiFetch<AccountResponse>(
    `${tenantPath(tenant)}/cloud-accounts/${encodeURIComponent(id)}`,
    { token },
  );
  return mapCloudAccount(res.account);
}

export async function createCloudAccount(
  token: string | undefined,
  tenant: string,
  body: CreateCloudAccountRequest,
): Promise<{ account: CloudAccount }> {
  const res = await apiFetch<AccountResponse>(
    `${tenantPath(tenant)}/cloud-accounts`,
    { token, method: "POST", body },
  );
  return { account: mapCloudAccount(res.account) };
}

// GET /tenants/{org}/cloud-accounts/{id}/providerconfig?clusterId=... renders
// the Crossplane ProviderConfig manifest; the response body is a plain string.
export async function renderCloudAccountProviderConfig(
  token: string | undefined,
  id: string,
  clusterId: string,
  tenant?: string,
): Promise<string> {
  return apiFetch<string>(
    `${tenantPath(tenant)}/cloud-accounts/${encodeURIComponent(id)}/providerconfig` +
      `?clusterId=${encodeURIComponent(clusterId)}`,
    { token },
  );
}

// POST /tenants/{org}/cloud-accounts/{id}/validate returns the updated account
// envelope (AccountOutputBody); the console derives the validation outcome
// from the account state fields, not a separate result payload.
export async function validateCloudAccount(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<CloudAccount> {
  const res = await apiFetch<AccountResponse>(
    `${tenantPath(tenant)}/cloud-accounts/${encodeURIComponent(id)}/validate`,
    { token, method: "POST" },
  );
  return mapCloudAccount(res.account);
}
