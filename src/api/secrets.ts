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
