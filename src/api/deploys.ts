import { apiFetch } from "@/api/client";
import type { CreateDeployRequest, Deploy, DeployPhase } from "@/api/types";
import { resolveTenant } from "@/tenant/current";

// Server REST surface: /api/v1/tenants/{org}/deploys + /instances/{id}.
function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

interface ServerDeployResult {
  instanceId: string;
  version: string;
  status: string; // "deploying" | "pending_approval"
  approvalId?: string;
  commitSha?: string;
  prUrl?: string;
}

export async function createDeploy(
  token: string | undefined,
  tenant: string,
  body: CreateDeployRequest,
): Promise<Deploy> {
  const org = resolveTenant(tenant);
  const res = await apiFetch<{ deploy: ServerDeployResult }>(
    `${tenantPath(org)}/deploys`,
    { token, method: "POST", body },
  );
  return {
    id: res.deploy.instanceId,
    tenant: org,
    itemId: body.itemId,
    version: res.deploy.version || body.version,
    clusterId: body.clusterId,
    name: body.name,
    phase: res.deploy.status === "pending_approval" ? "pending" : "syncing",
    gitopsMode: res.deploy.prUrl ? "pull-request" : "direct-commit",
    prUrl: res.deploy.prUrl ?? null,
    instanceId: res.deploy.instanceId,
    message: null,
    createdAt: new Date().toISOString(),
  };
}

interface ServerInstance {
  id: string;
  orgId: string;
  clusterId: string;
  catalogItemId: string;
  version: string;
  resourceRef?: { name?: string };
  health?: string;
  state?: string;
  statusMessage?: string;
  prUrl?: string;
  createdAt: string;
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
  const res = await apiFetch<{ instance: ServerInstance }>(
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
    name: i.resourceRef?.name || i.id,
    phase: mapPhase(i),
    gitopsMode: i.prUrl ? "pull-request" : "direct-commit",
    prUrl: i.prUrl ?? null,
    instanceId: i.id,
    message: i.statusMessage ?? null,
    createdAt: i.createdAt,
  };
}
