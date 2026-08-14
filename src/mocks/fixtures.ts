import type {
  Capability,
  ClusterDetail,
  ClusterSummary,
  CreateClusterRequest,
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
  description: "Local kind cluster for development",
  agentVersion: "0.3.1",
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
  agentVersion: "0.3.0",
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
  agentVersion: "0.3.1",
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

function manifestFor(name: string, token: string): string {
  return [
    "apiVersion: v1",
    "kind: Namespace",
    "metadata:",
    "  name: inari-system",
    "---",
    "apiVersion: apps/v1",
    "kind: Deployment",
    "metadata:",
    "  name: inari-agent",
    "  namespace: inari-system",
    "spec:",
    "  replicas: 1",
    "  selector:",
    "    matchLabels:",
    "      app: inari-agent",
    "  template:",
    "    metadata:",
    "      labels:",
    "        app: inari-agent",
    "    spec:",
    "      containers:",
    "        - name: agent",
    "          image: ghcr.io/7k-inari/inari/agent:0.3.1",
    "          env:",
    `            - name: INARI_CLUSTER_NAME`,
    `              value: "${name}"`,
    "            - name: INARI_REGISTRATION_TOKEN",
    `              value: "${token}"`,
    "",
  ].join("\n");
}

export interface MockState {
  clusters: ClusterDetail[];
  capabilities: Record<string, Capability[]>;
}

function seedState(): MockState {
  return {
    clusters: [connectedCluster, degradedCluster, otherTenantCluster].map((c) => ({ ...c })),
    capabilities: {
      [connectedCluster.id]: kindCapabilities.map((c) => ({ ...c })),
      [degradedCluster.id]: [],
      [otherTenantCluster.id]: [],
    },
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
};

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

export function capabilitiesFor(id: string): Capability[] | undefined {
  if (!findCluster(id)) return undefined;
  return state.capabilities[id] ?? [];
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
    labels: body.labels,
    capabilityCount: 0,
    lastSeenAt: null,
    createdAt: new Date().toISOString(),
    description: body.description,
    agentVersion: null,
  };
  state.clusters.push(cluster);
  state.capabilities[id] = [];
  return {
    cluster,
    registrationToken: token,
    tokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    install: {
      manifestYaml: manifestFor(body.name, token),
      helmCommand: `helm install inari-agent oci://ghcr.io/7k-inari/inari/charts/agent --set cluster.name=${body.name} --set registration.token=${token}`,
    },
  };
}
