import type { ClusterAccessInfo, CreateClusterRequest } from "@/api/clusters";
import type {
  Capability,
  ClusterDetail,
  ClusterSummary,
  CreateClusterResponse,
} from "@/api/types";

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export const connectedCluster: ClusterDetail = {
  id: "cl-kind-dev",
  name: "kind-dev",
  tenant: "acme",
  status: "connected",
  k8sVersion: "v1.30.2",
  labels: { env: "dev", cloud: "kind" },
  capabilityCount: 8,
  lastSeenAt: iso(now - 30_000),
  createdAt: iso(now - 86_400_000),
};

export const degradedCluster: ClusterDetail = {
  id: "cl-eks-prod",
  name: "eks-prod-eu",
  tenant: "acme",
  status: "degraded",
  k8sVersion: "v1.29.6",
  labels: { env: "prod", cloud: "aws", region: "eu-west-1" },
  capabilityCount: 21,
  lastSeenAt: iso(now - 900_000),
  createdAt: iso(now - 30 * 86_400_000),
};

export const otherTenantCluster: ClusterDetail = {
  id: "cl-gke-staging",
  name: "gke-staging",
  tenant: "globex",
  status: "connected",
  k8sVersion: "v1.30.1",
  labels: { env: "staging", cloud: "gcp" },
  capabilityCount: 12,
  lastSeenAt: iso(now - 60_000),
  createdAt: iso(now - 7 * 86_400_000),
};

export const kindCapabilities: Capability[] = [
  {
    id: "cap-crd-certificates",
    kind: "crd",
    name: "certificates.cert-manager.io",
    group: "cert-manager.io",
    version: "v1",
    managementMode: "observe",
    updatedAt: iso(now - 120_000),
  },
  {
    id: "cap-crd-externalsecrets",
    kind: "crd",
    name: "externalsecrets.external-secrets.io",
    group: "external-secrets.io",
    version: "v1beta1",
    managementMode: "observe",
    updatedAt: iso(now - 120_000),
  },
  {
    id: "cap-csv-certmanager",
    kind: "olm-csv",
    name: "cert-manager",
    group: "operators.coreos.com",
    version: "1.15.0",
    managementMode: "adopt",
    updatedAt: iso(now - 300_000),
  },
  {
    id: "cap-provider-aws",
    kind: "crossplane-provider",
    name: "provider-aws-s3",
    group: "pkg.crossplane.io",
    version: "1.9.1",
    managementMode: "adopt",
    updatedAt: iso(now - 600_000),
  },
  {
    id: "cap-xrd-bucket",
    kind: "xrd",
    name: "xbuckets.storage.inari.io",
    group: "storage.inari.io",
    version: "v1alpha1",
    managementMode: "observe",
    updatedAt: iso(now - 600_000),
  },
  {
    id: "cap-helm-argo",
    kind: "helm-release",
    name: "argocd",
    group: "argocd",
    version: "7.3.4",
    managementMode: "adopt",
    updatedAt: iso(now - 1_800_000),
  },
  {
    id: "cap-rgd-postgres",
    kind: "kro-rgd",
    name: "postgresql-aws",
    group: "kro.run",
    version: "0.2.0",
    managementMode: "ignore",
    updatedAt: iso(now - 3_600_000),
  },
  {
    id: "cap-crd-applications",
    kind: "crd",
    name: "applications.argoproj.io",
    group: "argoproj.io",
    version: "v1alpha1",
    managementMode: "observe",
    updatedAt: iso(now - 1_800_000),
  },
];

function defaultAccessInfo(cluster: ClusterDetail): ClusterAccessInfo {
  return {
    audience: "kubernetes",
    issuerUrl: "https://keycloak.inari.test/realms/inari",
    kubectlAccessEnabled: true,
    kubectlClientId: `org-${cluster.tenant}-kubectl`,
    organization: cluster.tenant,
    proxyUrl: "https://kubeproxy.inari.test",
    tunnelAvailable: true,
  };
}

export interface MockState {
  clusters: ClusterDetail[];
  capabilities: Record<string, Capability[]>;
  accessInfo: Record<string, ClusterAccessInfo>;
  // Clusters whose decommission is blocked by shared (non-Inari-managed)
  // resources — the mock answers 409 until force is passed.
  decommissionBlocked: string[];
  // Drained instance IDs reported by a successful decommission, per cluster.
  decommissionDrain: Record<string, string[]>;
}

function seedState(): MockState {
  return {
    clusters: [connectedCluster, degradedCluster, otherTenantCluster].map((c) => ({ ...c })),
    capabilities: {
      [connectedCluster.id]: kindCapabilities.map((c) => ({ ...c })),
      [degradedCluster.id]: [],
      [otherTenantCluster.id]: [],
    },
    accessInfo: Object.fromEntries(
      [connectedCluster, degradedCluster, otherTenantCluster].map((c) => [
        c.id,
        defaultAccessInfo(c),
      ]),
    ),
    decommissionBlocked: [],
    decommissionDrain: {},
  };
}

let state: MockState = seedState();

export const mockControl = {
  reset() {
    state = seedState();
  },
  setClusterStatus(id: string, status: ClusterDetail["status"]) {
    const cluster = state.clusters.find((c) => c.id === id);
    if (cluster) {
      cluster.status = status;
      cluster.lastSeenAt = new Date().toISOString();
    }
  },
  getState(): MockState {
    return state;
  },
  setDecommissionBlocked(id: string, blocked: boolean) {
    const idx = state.decommissionBlocked.indexOf(id);
    if (blocked && idx === -1) state.decommissionBlocked.push(id);
    if (!blocked && idx !== -1) state.decommissionBlocked.splice(idx, 1);
  },
  setDecommissionDrain(id: string, instanceIds: string[]) {
    state.decommissionDrain[id] = instanceIds;
  },
  setAccessInfo(id: string, patch: Partial<ClusterAccessInfo>) {
    const info = state.accessInfo[id];
    if (info) state.accessInfo[id] = { ...info, ...patch };
  },
};

// Cluster lifecycle transitions (approve/cordon/uncordon/revoke/
// decommission). Each returns the updated cluster, or undefined when the
// cluster does not exist.
function transition(id: string, status: ClusterDetail["status"]): ClusterDetail | undefined {
  const cluster = findCluster(id);
  if (!cluster) return undefined;
  cluster.status = status;
  cluster.lastSeenAt = new Date().toISOString();
  return cluster;
}

export function approveClusterMock(id: string): ClusterDetail | undefined {
  return transition(id, "connected");
}

export function cordonClusterMock(id: string): ClusterDetail | undefined {
  return transition(id, "cordoned");
}

export function uncordonClusterMock(id: string): ClusterDetail | undefined {
  return transition(id, "connected");
}

export function revokeClusterMock(id: string): ClusterDetail | undefined {
  return transition(id, "revoked");
}

export function isDecommissionBlocked(id: string): boolean {
  return state.decommissionBlocked.includes(id);
}

export function decommissionClusterMock(id: string): { cluster: ClusterDetail; drained: string[] } | undefined {
  const cluster = transition(id, "decommissioned");
  if (!cluster) return undefined;
  return { cluster, drained: state.decommissionDrain[id] ?? [] };
}

function toSummary(c: ClusterDetail): ClusterSummary {
  return {
    id: c.id,
    name: c.name,
    tenant: c.tenant,
    status: c.status,
    k8sVersion: c.k8sVersion,
    labels: c.labels,
    capabilityCount: c.capabilityCount,
    lastSeenAt: c.lastSeenAt,
    createdAt: c.createdAt,
  };
}

export function listForTenant(tenant: string | null): ClusterSummary[] {
  return state.clusters
    .filter((c) => !tenant || c.tenant === tenant)
    .map(toSummary);
}

export function findCluster(id: string): ClusterDetail | undefined {
  return state.clusters.find((c) => c.id === id);
}

export function accessInfoFor(id: string): ClusterAccessInfo | undefined {
  if (!findCluster(id)) return undefined;
  return state.accessInfo[id];
}

export function capabilitiesFor(id: string): Capability[] | undefined {
  if (!findCluster(id)) return undefined;
  return state.capabilities[id] ?? [];
}

export function removeCluster(id: string): ClusterDetail | undefined {
  const idx = state.clusters.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  const [removed] = state.clusters.splice(idx, 1);
  delete state.capabilities[id];
  return removed;
}

export function registerCluster(
  tenant: string,
  body: CreateClusterRequest,
): CreateClusterResponse {
  const id = `cl-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const token = `inari-reg-${Math.random().toString(36).slice(2, 18)}`;
  const cluster: ClusterDetail = {
    id,
    name: body.name,
    tenant,
    status: "pending",
    k8sVersion: null,
    labels: body.labels ?? {},
    capabilityCount: 0,
    lastSeenAt: null,
    createdAt: new Date().toISOString(),
  };
  state.clusters.push(cluster);
  state.capabilities[id] = [];
  return {
    cluster,
    registrationToken: token,
    tokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    install: {
      helmCommand: `helm install inari-agent oci://ghcr.io/7k-inari/charts/inari-agent --set config.tenantID=${cluster.tenant} --set config.registrationToken=${token}`,
    },
  };
}
