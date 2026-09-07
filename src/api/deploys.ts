import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import type { CreateDeployRequest, Deploy, DeployPhase } from "@/api/types";
import { resolveTenant } from "@/tenant/current";

// Server REST surface: /api/v1/tenants/{org}/deploys + /instances/{id}.
// Server shapes come from the huma-generated OpenAPI contract (pinned snapshot
// in openapi/openapi.yaml); UI view models stay in @/api/types.
function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

type ServerInstance = components["schemas"]["InstanceView"];
type DeployResponse = components["schemas"]["DeployOutputBody"];
type GetInstanceResponse = components["schemas"]["GetOutputBody"];

export async function createDeploy(
  token: string | undefined,
  tenant: string,
  body: CreateDeployRequest,
): Promise<Deploy> {
  const org = resolveTenant(tenant);
  const res = await apiFetch<DeployResponse>(
    `${tenantPath(org)}/deploys`,
    { token, method: "POST", body },
  );
  return {
    id: res.deploy.InstanceID,
    tenant: org,
    itemId: body.itemId,
    version: res.deploy.Version || body.version,
    clusterId: body.clusterId,
    name: body.name,
    phase: res.deploy.Status === "pending_approval" ? "pending" : "syncing",
    gitopsMode: res.deploy.PRURL ? "pull-request" : "direct-commit",
    prUrl: res.deploy.PRURL || null,
    instanceId: res.deploy.InstanceID,
    message: null,
    createdAt: new Date().toISOString(),
  };
}

function mapPhase(i: ServerInstance): DeployPhase {
  if (i.health === "healthy") return "healthy";
  if (i.health === "degraded" || i.health === "missing") return "degraded";
  if (i.state === "failed") return "failed";
  return "syncing";
}

// The server has no GET /deploys/{id}: deploy status is tracked on the
// resource instance. The wizard polls this after createDeploy.
export async function getDeploy(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<Deploy> {
  const org = resolveTenant(tenant);
  const res = await apiFetch<GetInstanceResponse>(
    `${tenantPath(org)}/instances/${encodeURIComponent(id)}`,
    { token },
  );
  const i = res.instance;
  return {
    id: i.id,
    tenant: i.orgId,
    itemId: i.catalogItemId,
    version: i.version,
    clusterId: i.clusterId,
    name: i.resourceRef.name || i.id,
    phase: mapPhase(i),
    gitopsMode: i.prUrl ? "pull-request" : "direct-commit",
    prUrl: i.prUrl ?? null,
    instanceId: i.id,
    message: i.statusMessage ?? null,
    createdAt: i.createdAt,
  };
}
