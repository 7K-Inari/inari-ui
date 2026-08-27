import { apiFetch } from "@/api/client";
import { config } from "@/config";
import type {
  Capability,
  CapabilityKind,
  ClusterDetail,
  ClusterStatus,
  ClusterSummary,
  CreateClusterRequest,
  CreateClusterResponse,
  ManagementMode,
} from "@/api/types";
import { resolveTenant } from "@/tenant/current";

// Server REST surface (inari-server, Huma): tenant slug in the path —
// /api/v1/tenants/{org}/clusters/... Detail helpers fall back to the active
// tenant context when no explicit tenant is passed.
function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

interface ServerCluster {
  id: string;
  orgId: string;
  name: string;
  kubernetesVersion?: string | null;
  labels?: Record<string, string> | null;
  state: string;
  agentVersion?: string | null;
  connectedAt?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
}

function mapStatus(state: string): ClusterStatus {
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

function mapCluster(c: ServerCluster): ClusterDetail {
  return {
    id: c.id,
    name: c.name,
    tenant: c.orgId,
    status: mapStatus(c.state),
    k8sVersion: c.kubernetesVersion ?? null,
    labels: c.labels ?? {},
    capabilityCount: 0, // not part of the list payload; the detail page loads capabilities
    lastSeenAt: c.lastSeenAt ?? null,
    createdAt: c.createdAt,
    agentVersion: c.agentVersion ?? null,
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
  const res = await apiFetch<{ cluster: ServerCluster }>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(id)}`,
    { token },
  );
  return mapCluster(res.cluster);
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

export async function createCluster(
  token: string | undefined,
  tenant: string,
  body: CreateClusterRequest,
): Promise<CreateClusterResponse> {
  const org = resolveTenant(tenant);
  const created = await apiFetch<{ cluster: ServerCluster }>(
    `${tenantPath(org)}/clusters`,
    { token, method: "POST", body },
  );
  // Issue the one-time registration token so the wizard can show it once.
  const tok = await apiFetch<TokenResponse>(
    `${tenantPath(org)}/clusters/${encodeURIComponent(created.cluster.id)}/tokens`,
    { token, method: "POST" },
  );
  const manifestYaml = await getInstallManifest(token, created.cluster.id, org);
  return {
    cluster: mapCluster(created.cluster),
    registrationToken: tok.token,
    tokenExpiresAt: tok.expiresAt,
    install: {
      manifestYaml,
      helmCommand: buildHelmCommand(org, tok.token),
    },
  };
}

// The inari-agent chart requires the tenant slug, the control-plane agent
// gateway URL, and the one-time registration token. The gateway comes from
// runtime config (per-deployment), not a hardcoded URL.
export function buildHelmCommand(tenant: string, registrationToken: string): string {
  return [
    "helm install inari-agent oci://ghcr.io/7k-inari/charts/inari-agent \\",
    `  --set tenant.slug=${tenant} \\`,
    `  --set agent.gatewayUrl=${config.agentGatewayUrl} \\`,
    `  --set registration.token=${registrationToken}`,
  ].join("\n");
}

// The server renders a fresh manifest (with a fresh embedded token) per call
// and returns application/yaml; apiFetch passes non-JSON through as text.
export function getInstallManifest(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<string> {
  return apiFetch<string>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(id)}/install-manifest`,
    { token, method: "POST" },
  );
}
