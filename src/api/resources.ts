import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import type {
  Deploy,
  ResourceHealth,
  ResourceInstanceDetail,
  ResourceInstanceSummary,
  UpgradeDiff,
} from "@/api/types";
import { resolveTenant } from "@/tenant/current";

// Server REST surface: /api/v1/tenants/{org}/instances...
// Server shapes come from the huma-generated OpenAPI contract (pinned snapshot
// in openapi/openapi.yaml); UI view models stay in @/api/types.
function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

type ServerInstance = components["schemas"]["InstanceView"];
type ListInstancesResponse = components["schemas"]["ListOutputBody1"];
type GetInstanceResponse = components["schemas"]["GetOutputBody"];
type DiffResponse = components["schemas"]["DiffOutputBody"];
type DeployResponse = components["schemas"]["DeployOutputBody"];

function mapHealth(h: string | undefined): ResourceHealth {
  switch (h) {
    case "healthy":
      return "healthy";
    case "degraded":
    case "missing":
      return "degraded";
    case "progressing":
    case "suspended":
      return "progressing";
    default:
      return "unknown";
  }
}

function mapInstance(i: ServerInstance): ResourceInstanceSummary {
  return {
    id: i.id,
    name: i.resourceRef.name || i.id,
    tenant: i.orgId,
    catalogItemId: i.catalogItemId,
    catalogItemName: i.catalogItemId, // server doesn't join the item name yet
    version: i.version,
    clusterId: i.clusterId,
    health: mapHealth(i.health),
    status: i.state ?? "unknown",
    ownerTeam: i.ownerTeam ?? "",
    updateAvailable: i.newVersionAvailable ? { from: i.version, to: i.latestVersion ?? "" } : null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

export async function listResources(
  token: string | undefined,
  tenant: string,
): Promise<ResourceInstanceSummary[]> {
  const res = await apiFetch<ListInstancesResponse>(
    `${tenantPath(resolveTenant(tenant))}/instances`,
    { token },
  );
  return (res.instances ?? []).map(mapInstance);
}

export async function getResource(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<ResourceInstanceDetail> {
  const res = await apiFetch<GetInstanceResponse>(
    `${tenantPath(resolveTenant(tenant))}/instances/${encodeURIComponent(id)}`,
    { token },
  );
  const base = mapInstance(res.instance);
  return {
    ...base,
    spec: (res.instance.spec ?? {}) as Record<string, unknown>,
  };
}

export async function getUpgradeDiff(
  token: string | undefined,
  id: string,
  to: string,
  tenant?: string,
): Promise<UpgradeDiff> {
  const res = await apiFetch<DiffResponse>(
    `${tenantPath(resolveTenant(tenant))}/instances/${encodeURIComponent(id)}/diff?to=${encodeURIComponent(to)}`,
    { token },
  );
  return {
    from: res.diff.currentVersion,
    to: res.diff.targetVersion,
    currentManifest: res.diff.currentManifest,
    upgradedManifest: res.diff.targetManifest,
  };
}

function mapDeployResult(res: DeployResponse, org: string): Deploy {
  return {
    id: res.deploy.InstanceID,
    tenant: org,
    itemId: "",
    version: res.deploy.Version,
    clusterId: "",
    name: "",
    phase: res.deploy.Status === "pending_approval" ? "pending" : "syncing",
    gitopsMode: res.deploy.PRURL ? "pull-request" : "direct-commit",
    prUrl: res.deploy.PRURL || null,
    instanceId: res.deploy.InstanceID,
    message: null,
    createdAt: new Date().toISOString(),
  };
}

export async function upgradeResource(
  token: string | undefined,
  id: string,
  to: string,
  tenant?: string,
): Promise<Deploy> {
  const org = resolveTenant(tenant);
  const res = await apiFetch<DeployResponse>(
    `${tenantPath(org)}/instances/${encodeURIComponent(id)}/upgrade`,
    { token, method: "POST", body: { toVersion: to } },
  );
  return mapDeployResult(res, org);
}

type UpdateInstanceRequest = components["schemas"]["UpdateInstanceInputBody"];
type RollbackRequest = components["schemas"]["RollbackInputBody"];

// Updates an instance's spec in place (re-renders at the current version).
export async function updateResourceSpec(
  token: string | undefined,
  id: string,
  spec: Record<string, unknown>,
  tenant?: string,
): Promise<Deploy> {
  const org = resolveTenant(tenant);
  const body: UpdateInstanceRequest = { spec };
  const res = await apiFetch<DeployResponse>(
    `${tenantPath(org)}/instances/${encodeURIComponent(id)}`,
    { token, method: "PATCH", body },
  );
  return mapDeployResult(res, org);
}

// Rolls an instance back to an explicit earlier catalog version.
export async function rollbackResource(
  token: string | undefined,
  id: string,
  toVersion: string,
  tenant?: string,
): Promise<Deploy> {
  const org = resolveTenant(tenant);
  const body: RollbackRequest = { toVersion };
  const res = await apiFetch<DeployResponse>(
    `${tenantPath(org)}/instances/${encodeURIComponent(id)}/rollback`,
    { token, method: "POST", body },
  );
  return mapDeployResult(res, org);
}

// Undeploys an instance: removes its desired state from the tenant repo and
// deletes the inventory row. May answer pending_approval when the catalog
// item's policy requires review.
export async function deleteResource(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<Deploy> {
  const org = resolveTenant(tenant);
  const res = await apiFetch<DeployResponse>(
    `${tenantPath(org)}/instances/${encodeURIComponent(id)}`,
    { token, method: "DELETE" },
  );
  return mapDeployResult(res, org);
}
