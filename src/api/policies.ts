import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Policy governance REST surface (inari-server, huma): policy packs,
// exemptions, and dry-run compliance evaluation. All shapes come from the
// pinned OpenAPI contract (openapi/openapi.yaml) — never hand-write server
// shapes here; view models stay thin aliases over the generated schemas.

type PolicyPack = components["schemas"]["PolicyPack"];
type PolicyAssignment = components["schemas"]["PolicyAssignment"];
type Exemption = components["schemas"]["Exemption"];
type Policy = components["schemas"]["Policy"];
type PolicyDecision = components["schemas"]["PolicyDecision"];

export type CreatePackRequest = components["schemas"]["CreatePackInputBody"];
export type AssignPackRequest = components["schemas"]["AssignPackInputBody"];
export type RequestExemptionRequest = components["schemas"]["RequestExemptionInputBody"];
export type DecideExemptionRequest = components["schemas"]["DecideExemptionInputBody"];
export type EvaluatePoliciesRequest = components["schemas"]["EvaluateInputBody"];

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

// ---- policy packs ----

export async function listPolicyPacks(
  token: string | undefined,
  tenant: string,
): Promise<PolicyPack[]> {
  const res = await apiFetch<{ packs: PolicyPack[] | null }>(
    `${tenantPath(tenant)}/policy-packs`,
    { token },
  );
  return res.packs ?? [];
}

export async function createPolicyPack(
  token: string | undefined,
  tenant: string,
  body: CreatePackRequest,
): Promise<PolicyPack> {
  const res = await apiFetch<{ pack: PolicyPack }>(
    `${tenantPath(tenant)}/policy-packs`,
    { token, method: "POST", body },
  );
  return res.pack;
}

export async function assignPolicyPack(
  token: string | undefined,
  tenant: string,
  packId: string,
  body: AssignPackRequest,
): Promise<PolicyAssignment> {
  const res = await apiFetch<{ assignment: PolicyAssignment }>(
    `${tenantPath(tenant)}/policy-packs/${encodeURIComponent(packId)}/assign`,
    { token, method: "POST", body },
  );
  return res.assignment;
}

export async function unassignPolicyPack(
  token: string | undefined,
  tenant: string,
  packId: string,
  assignmentId: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/policy-packs/${encodeURIComponent(packId)}/assignments/${encodeURIComponent(assignmentId)}`,
    { token, method: "DELETE" },
  );
}

// ---- exemptions ----

export async function listExemptions(
  token: string | undefined,
  tenant: string,
): Promise<Exemption[]> {
  const res = await apiFetch<{ exemptions: Exemption[] | null }>(
    `${tenantPath(tenant)}/exemptions`,
    { token },
  );
  return res.exemptions ?? [];
}

export async function requestExemption(
  token: string | undefined,
  tenant: string,
  body: RequestExemptionRequest,
): Promise<Exemption> {
  const res = await apiFetch<{ exemption: Exemption }>(
    `${tenantPath(tenant)}/exemptions`,
    { token, method: "POST", body },
  );
  return res.exemption;
}

export async function decideExemption(
  token: string | undefined,
  tenant: string,
  id: string,
  body: DecideExemptionRequest,
): Promise<Exemption> {
  const res = await apiFetch<{ exemption: Exemption }>(
    `${tenantPath(tenant)}/exemptions/${encodeURIComponent(id)}/decide`,
    { token, method: "POST", body },
  );
  return res.exemption;
}

// ---- compliance ----

export async function listPolicies(
  token: string | undefined,
  tenant: string,
): Promise<Policy[]> {
  const res = await apiFetch<{ policies: Policy[] | null }>(
    `${tenantPath(tenant)}/policies`,
    { token },
  );
  return res.policies ?? [];
}

export async function evaluatePolicies(
  token: string | undefined,
  tenant: string,
  body: EvaluatePoliciesRequest,
): Promise<PolicyDecision> {
  const res = await apiFetch<{ decision: PolicyDecision }>(
    `${tenantPath(tenant)}/policies/evaluate`,
    { token, method: "POST", body },
  );
  return res.decision;
}

// ---- catalog visibility (tenant overlay) ----
// TODO(contract-sync): proposed huma shapes not yet in the pinned contract
// (1.6.0); swap for generated schemas after npm run sync:api.

export interface CatalogVisibilityRule {
  itemId: string;
  itemName: string;
  visible: boolean;
  updatedBy: string;
  /** Format: date-time */
  updatedAt: string;
}

export async function listCatalogVisibility(
  token: string | undefined,
  tenant: string,
): Promise<CatalogVisibilityRule[]> {
  const res = await apiFetch<{ rules: CatalogVisibilityRule[] | null }>(
    `${tenantPath(tenant)}/catalog-visibility`,
    { token },
  );
  return res.rules ?? [];
}

export async function putCatalogVisibility(
  token: string | undefined,
  tenant: string,
  itemId: string,
  visible: boolean,
): Promise<void> {
  await apiFetch<unknown>(
    `${tenantPath(tenant)}/catalog-visibility/${encodeURIComponent(itemId)}`,
    { token, method: "PUT", body: { visible } },
  );
}
