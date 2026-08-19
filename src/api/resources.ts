import { apiFetch } from "@/api/client";
import type {
  Deploy,
  ResourceHealth,
  ResourceInstanceDetail,
  ResourceInstanceSummary,
  UpgradeDiff,
} from "@/api/types";
import { resolveTenant } from "@/tenant/current";

// Server REST surface: /api/v1/tenants/{org}/instances...
function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

interface ServerResourceRef {
  kind?: string;
  name?: string;
  namespace?: string;
}

interface ServerInstance {
  id: string;
  orgId: string;
  clusterId: string;
  clusterName?: string;
  catalogItemId: string;
  version: string;
  ownerTeam?: string;
  spec?: Record<string, unknown>;
  resourceRef?: ServerResourceRef;
  health?: string;
  syncState?: string;
  statusMessage?: string;
  state?: string;
  prUrl?: string;
  argocdUrl?: string | null;
  newVersionAvailable?: boolean;
  latestVersion?: string;
  composedResources?: ResourceInstanceDetail["composedResources"];
  createdAt: string;
}

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
    name: i.resourceRef?.name || i.id,
    tenant: i.orgId,
    catalogItemId: i.catalogItemId,
    catalogItemName: i.catalogItemId, // server doesn't join the item name yet
    version: i.version,
    clusterId: i.clusterId,
    clusterName: i.clusterName ?? i.clusterId, // server doesn't join the cluster name yet
    health: mapHealth(i.health),
    status: i.state ?? "unknown",
    ownerTeam: i.ownerTeam ?? "",
    updateAvailable: i.newVersionAvailable ? { from: i.version, to: i.latestVersion ?? "" } : null,
    createdAt: i.createdAt,
  };
}

export async function listResources(
  token: string | undefined,
  tenant: string,
): Promise<ResourceInstanceSummary[]> {
  const res = await apiFetch<{ instances: ServerInstance[] | null }>(
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
  const res = await apiFetch<{ instance: ServerInstance }>(
    `${tenantPath(resolveTenant(tenant))}/instances/${encodeURIComponent(id)}`,
    { token },
  );
  const base = mapInstance(res.instance);
  return {
    ...base,
    spec: res.instance.spec ?? {},
    composedResources: (res.instance.composedResources ?? []) as ResourceInstanceDetail["composedResources"],
    argocdUrl: res.instance.argocdUrl ?? null,
  };
}

interface ServerDiffPreview {
  instanceId: string;
  itemId: string;
  currentVersion: string;
  targetVersion: string;
  currentManifest: string;
  targetManifest: string;
}

export async function getUpgradeDiff(
  token: string | undefined,
  id: string,
  to: string,
  tenant?: string,
): Promise<UpgradeDiff> {
  const res = await apiFetch<{ diff: ServerDiffPreview }>(
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

interface ServerDeployResult {
  instanceId: string;
  version: string;
  status: string;
  approvalId?: string;
  commitSha?: string;
  prUrl?: string;
}

export async function upgradeResource(
  token: string | undefined,
  id: string,
  to: string,
  tenant?: string,
): Promise<Deploy> {
  const org = resolveTenant(tenant);
  const res = await apiFetch<{ deploy: ServerDeployResult }>(
    `${tenantPath(org)}/instances/${encodeURIComponent(id)}/upgrade`,
    { token, method: "POST", body: { toVersion: to } },
  );
  return {
    id: res.deploy.instanceId,
    tenant: org,
    itemId: "",
    version: res.deploy.version,
    clusterId: "",
    name: "",
    phase: res.deploy.status === "pending_approval" ? "pending" : "syncing",
    gitopsMode: res.deploy.prUrl ? "pull-request" : "direct-commit",
    prUrl: res.deploy.prUrl ?? null,
    instanceId: res.deploy.instanceId,
    message: null,
    createdAt: new Date().toISOString(),
  };
}
