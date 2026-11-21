import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

export type DeploymentPlanRequest = components["schemas"]["PlanRequest"];
export type DeploymentPreflight = components["schemas"]["Preflight"];
export type DeploymentPlan = components["schemas"]["Plan"];
export type InstanceObservability = components["schemas"]["InstanceObservability"];

type PreflightResponse = components["schemas"]["PreflightOutputBody"];
type SubmitResponse = components["schemas"]["SubmitOutputBody"];
type GetPlanResponse = components["schemas"]["GetPlanOutputBody"];
type InstanceResponse = components["schemas"]["InstanceOutputBody"];

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function preflightDeploymentPlan(
  token: string | undefined,
  tenant: string,
  body: DeploymentPlanRequest,
): Promise<DeploymentPreflight> {
  const res = await apiFetch<PreflightResponse>(`${tenantPath(tenant)}/deployment-plans/preflight`, {
    token,
    method: "POST",
    body,
  });
  return res.preflight;
}

export async function submitDeploymentPlan(
  token: string | undefined,
  tenant: string,
  body: DeploymentPlanRequest,
): Promise<DeploymentPlan> {
  const res = await apiFetch<SubmitResponse>(`${tenantPath(tenant)}/deployment-plans`, {
    token,
    method: "POST",
    body,
  });
  return res.plan;
}

export async function getDeploymentPlan(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<DeploymentPlan> {
  const res = await apiFetch<GetPlanResponse>(`${tenantPath(tenant)}/deployment-plans/${encodeURIComponent(id)}`, { token });
  return res.plan;
}

export async function getInstanceObservability(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<InstanceObservability> {
  const res = await apiFetch<InstanceResponse>(`${tenantPath(tenant)}/instances/${encodeURIComponent(id)}/observability`, { token });
  return res.observability;
}
