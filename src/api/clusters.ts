import { apiFetch } from "@/api/client";
import { config } from "@/config";
import type { components } from "@/api/__generated__/schema";
import type {
  Capability,
  CapabilityKind,
  ClusterDetail,
  ClusterStatus,
  ClusterSummary,
  CreateClusterResponse,
  ManagementMode,
} from "@/api/types";
import { resolveTenant } from "@/tenant/current";

// Server REST surface (inari-server, Huma): tenant slug in the path —
// /api/v1/tenants/{org}/clusters/... Detail helpers fall back to the active
// tenant context when no explicit tenant is passed.
// Server shapes come from the huma-generated OpenAPI contract (pinned
// snapshot in openapi/openapi.yaml); UI view models stay in @/api/types.
function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

type ServerCluster = components["schemas"]["Cluster"];
export type CreateClusterRequest = components["schemas"]["CreateClusterInputBody"];

// Shared health derivation used by the cluster list and the overview
// dashboard card — both must agree on the state → status mapping.
export function clusterHealth(state: string): ClusterStatus {
  switch (state) {
    case "active":
      return "connected";
    case "degraded":
      return "degraded";
    case "pending_registration":
      return "pending";
    default:
      return "disconnected";
  }
}

function mapCluster(c: ServerCluster): ClusterSummary {
  return {
    id: c.id,
    name: c.name,
    tenant: c.orgId,
    status: clusterHealth(c.state),
    k8sVersion: c.kubernetesVersion ?? null,
    labels: c.labels ?? {},
    capabilityCount: 0, // not part of the list payload; the detail page loads capabilities
    lastSeenAt: c.lastSeenAt ?? null,
    createdAt: c.createdAt,
    kubectlProxyDisabled: c.kubectlProxyDisabled,
  };
}

interface ServerCapability {
  id: string;
  kind: string;
  name: string;
  group?: string;
  version?: string;
  managementMode: ManagementMode;
  lastSeenAt?: string;
  firstSeenAt?: string;
}

function mapCapability(c: ServerCapability): Capability {
  return {
    id: c.id,
    kind: c.kind as CapabilityKind,
    name: c.name,
    group: c.group ?? "",
    version: c.version ?? "",
    managementMode: c.managementMode,
    updatedAt: c.lastSeenAt ?? c.firstSeenAt ?? "",
  };
}

export async function listClusters(
  token: string | undefined,
  tenant: string,
): Promise<ClusterSummary[]> {
  const res = await apiFetch<{ clusters: ServerCluster[] | null }>(
    `${tenantPath(resolveTenant(tenant))}/clusters`,
    { token },
  );
  return (res.clusters ?? []).map(mapCluster);
}

export async function getCluster(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<ClusterDetail> {
  const res = await apiFetch<{ cluster: ServerCluster; kubectlProxyEnabled: boolean }>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(id)}`,
    { token },
  );
  return { ...mapCluster(res.cluster), kubectlProxyEnabled: res.kubectlProxyEnabled };
}

export type ClusterAccessInfo = components["schemas"]["ClusterAccessInfo"];

// Kubelogin kubeconfig inputs for the kubectl-proxy setup flow. The server
// never returns the API-server URL (pull-only) — the user's own kubeconfig
// supplies it.
export async function getAccessInfo(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<ClusterAccessInfo> {
  const res = await apiFetch<components["schemas"]["AccessInfoOutputBody"]>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(id)}/access-info`,
    { token },
  );
  return res.accessInfo;
}

// Flips the per-cluster kubectl-proxy opt-out. The response carries the
// server-computed effective enablement (global kill switch ANDed in).
export async function updateClusterSettings(
  token: string | undefined,
  id: string,
  kubectlProxyDisabled: boolean,
  tenant?: string,
): Promise<ClusterDetail> {
  const res = await apiFetch<{ cluster: ServerCluster; kubectlProxyEnabled: boolean }>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(id)}`,
    { token, method: "PATCH", body: { kubectlProxyDisabled } },
  );
  return { ...mapCluster(res.cluster), kubectlProxyEnabled: res.kubectlProxyEnabled };
}

export async function getCapabilities(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<Capability[]> {
  const res = await apiFetch<{ capabilities: ServerCapability[] | null }>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(id)}/capabilities`,
    { token },
  );
  return (res.capabilities ?? []).map(mapCapability);
}

interface TokenResponse {
  token: string;
  expiresAt: string;
}

export async function issueRegistrationToken(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(id)}/tokens`,
    { token, method: "POST" },
  );
}

export async function createCluster(
  token: string | undefined,
  tenant: string,
  body: CreateClusterRequest,
): Promise<CreateClusterResponse> {
  const org = resolveTenant(tenant);
  const created = await apiFetch<{ cluster: ServerCluster; kubectlProxyEnabled: boolean }>(
    `${tenantPath(org)}/clusters`,
    { token, method: "POST", body },
  );
  // Issue the one-time registration token so the wizard can show it once.
  const tok = await issueRegistrationToken(token, created.cluster.id, org);
  return {
    cluster: { ...mapCluster(created.cluster), kubectlProxyEnabled: created.kubectlProxyEnabled },
    registrationToken: tok.token,
    tokenExpiresAt: tok.expiresAt,
    install: {
      helmCommand: buildHelmCommand(created.cluster.orgId, tok.token),
    },
  };
}

// The inari-agent chart requires the tenant ID, the control-plane address
// agents dial out to, and the one-time registration token. The gateway comes
// from runtime config (per-deployment), not a hardcoded URL. The chart
// (oci://ghcr.io/7k-inari/charts/inari-agent) is the single source of truth
// for what gets installed.
export function buildHelmCommand(orgID: string, registrationToken: string): string {
  return [
    "helm install inari-agent oci://ghcr.io/7k-inari/charts/inari-agent \\",
    `  --set config.tenantID=${orgID} \\`,
    `  --set config.controlPlane=${config.agentGatewayUrl} \\`,
    `  --set config.registrationToken=${registrationToken}`,
  ].join("\n");
}

// Cancels a pending registration. The server rejects deletes for clusters
// that already connected (409), so callers should only offer this for
// pending clusters and surface API errors.
export function deleteCluster(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<void> {
  return apiFetch<void>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(id)}`,
    { token, method: "DELETE" },
  );
}
