// M3.W2: cluster addons fixtures (Feature C). Mirrors the M3W2 server
// contract (inari-server internal/types.ClusterAddon + AddonView). Wire
// shapes are hand-written here because the pinned OpenAPI snapshot does not
// yet include the addons paths — see src/api/addons.ts (TODO contract-sync).

import type { AddonDeployMode, AddonState } from "@/api/addons";

export interface MockAddon {
  id: string;
  orgId: string;
  clusterId: string; // "*" for fleet (ApplicationSet) rows
  catalogItem: string;
  state: AddonState;
  deployMode: AddonDeployMode;
  repoId?: string;
  repoPath?: string;
  source: {
    kind: "helm";
    helm: { repoUrl: string; chart: string; version: string };
  };
  chartVersion?: string;
  values?: Record<string, unknown>;
  argocdApp?: string;
  health?: string;
  sync?: string;
  commitSha?: string;
  prUrl?: string;
  pruneEnabled: boolean;
  namespace?: string;
  clusterSelector?: Record<string, string>;
  discoveredMeta?: Record<string, unknown>;
  availableVersions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AddonsMockState {
  addons: Record<string, MockAddon[]>;
}

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

const CERT_MANAGER_VERSIONS = ["1.14.5", "1.15.0", "1.16.1"];

function seedState(): AddonsMockState {
  const managedCertManager: MockAddon = {
    id: "addon-cert-manager",
    orgId: "acme",
    clusterId: "cl-kind-dev",
    catalogItem: "cat-cert-manager",
    state: "managed",
    deployMode: "application",
    repoId: "repo-baseline",
    repoPath: "addons/cert-manager",
    source: {
      kind: "helm",
      helm: {
        repoUrl: "https://charts.jetstack.io",
        chart: "cert-manager",
        version: "1.15.0",
      },
    },
    chartVersion: "1.15.0",
    values: { enableHA: true },
    argocdApp: "inari-addon-addon-cert-manager",
    health: "Healthy",
    sync: "Synced",
    commitSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    pruneEnabled: false,
    namespace: "cert-manager",
    availableVersions: CERT_MANAGER_VERSIONS,
    createdAt: iso(now - 20 * 86_400_000),
    updatedAt: iso(now - 2 * 86_400_000),
  };
  // PR-policy repo: latest write is a pending PR, prune already enabled.
  const managedExternalSecrets: MockAddon = {
    id: "addon-external-secrets",
    orgId: "acme",
    clusterId: "cl-kind-dev",
    catalogItem: "cat-external-secrets",
    state: "managed",
    deployMode: "application",
    repoId: "repo-team-alpha",
    repoPath: "addons/external-secrets",
    source: {
      kind: "helm",
      helm: {
        repoUrl: "https://charts.external-secrets.io",
        chart: "external-secrets",
        version: "0.10.4",
      },
    },
    chartVersion: "0.10.4",
    values: {},
    argocdApp: "inari-addon-addon-external-secrets",
    health: "Progressing",
    sync: "OutOfSync",
    prUrl: "https://github.com/acme/team-alpha-gitops/pull/42",
    pruneEnabled: true,
    namespace: "external-secrets",
    availableVersions: ["0.9.20", "0.10.4"],
    createdAt: iso(now - 10 * 86_400_000),
    updatedAt: iso(now - 86_400_000),
  };
  // Operator-sunset Phase 1: ExternalDNS and ArgoCD as first-class addons.
  const managedExternalDns: MockAddon = {
    id: "addon-external-dns",
    orgId: "acme",
    clusterId: "cl-kind-dev",
    catalogItem: "cat-external-dns",
    state: "managed",
    deployMode: "application",
    repoId: "repo-baseline",
    repoPath: "addons/external-dns",
    source: {
      kind: "helm",
      helm: {
        repoUrl: "https://kubernetes-sigs.github.io/external-dns/",
        chart: "external-dns",
        version: "1.15.0",
      },
    },
    chartVersion: "1.15.0",
    values: { policy: "upsert-only" },
    argocdApp: "inari-addon-addon-external-dns",
    health: "Healthy",
    sync: "Synced",
    commitSha: "d4e5f60718293a4b5c6d7e8f9012345678a1b2c3",
    pruneEnabled: false,
    namespace: "external-dns",
    availableVersions: ["1.15.2", "1.15.0"],
    createdAt: iso(now - 12 * 86_400_000),
    updatedAt: iso(now - 12 * 86_400_000),
  };
  // Fleet-wide ArgoCD via ApplicationSet.
  const fleetArgocd: MockAddon = {
    id: "addon-argocd",
    orgId: "acme",
    clusterId: "*",
    catalogItem: "cat-argocd",
    state: "managed",
    deployMode: "applicationset",
    repoId: "repo-baseline",
    repoPath: "addons/argocd",
    source: {
      kind: "helm",
      helm: {
        repoUrl: "https://argoproj.github.io/argo-helm",
        chart: "argo-cd",
        version: "7.5.2",
      },
    },
    chartVersion: "7.5.2",
    values: { server: { replicas: 2 } },
    argocdApp: "inari-addonset-addon-argocd",
    health: "Healthy",
    sync: "Synced",
    commitSha: "e5f60718293a4b5c6d7e8f9012345678a1b2c3d4",
    pruneEnabled: false,
    namespace: "argocd",
    clusterSelector: { env: "dev" },
    availableVersions: ["7.6.12", "7.5.2"],
    createdAt: iso(now - 9 * 86_400_000),
    updatedAt: iso(now - 9 * 86_400_000),
  };
  const failedIstio: MockAddon = {
    id: "addon-istio",
    orgId: "acme",
    clusterId: "cl-kind-dev",
    catalogItem: "cat-istio",
    state: "update_failed",
    deployMode: "application",
    repoId: "repo-baseline",
    repoPath: "addons/istio",
    source: {
      kind: "helm",
      helm: { repoUrl: "https://istio-release.storage.googleapis.com/charts", chart: "base", version: "1.23.2" },
    },
    chartVersion: "1.23.2",
    values: {},
    argocdApp: "inari-addon-addon-istio",
    health: "Degraded",
    sync: "OutOfSync",
    commitSha: "b2c3d4e5f60718293a4b5c6d7e8f9012345678a1",
    pruneEnabled: false,
    namespace: "istio-system",
    availableVersions: ["1.22.3", "1.23.2"],
    createdAt: iso(now - 15 * 86_400_000),
    updatedAt: iso(now - 3_600_000),
  };
  // Fleet row: clusterId "*" with a selector matching cl-kind-dev's labels.
  const fleetMonitoring: MockAddon = {
    id: "addon-monitoring",
    orgId: "acme",
    clusterId: "*",
    catalogItem: "cat-monitoring-stack",
    state: "managed",
    deployMode: "applicationset",
    repoId: "repo-baseline",
    repoPath: "addons/monitoring-stack",
    source: {
      kind: "helm",
      helm: {
        repoUrl: "https://prometheus-community.github.io/helm-charts",
        chart: "kube-prometheus-stack",
        version: "65.3.1",
      },
    },
    chartVersion: "65.3.1",
    values: {},
    argocdApp: "inari-addonset-addon-monitoring",
    health: "Healthy",
    sync: "Synced",
    commitSha: "c3d4e5f60718293a4b5c6d7e8f9012345678a1b2",
    pruneEnabled: false,
    namespace: "monitoring",
    clusterSelector: { env: "dev" },
    availableVersions: ["65.3.1"],
    createdAt: iso(now - 8 * 86_400_000),
    updatedAt: iso(now - 8 * 86_400_000),
  };
  const discoveredMetricsServer: MockAddon = {
    id: "addon-disc-metrics-server",
    orgId: "acme",
    clusterId: "cl-kind-dev",
    catalogItem: "cat-metrics-server",
    state: "discovered",
    deployMode: "application",
    source: {
      kind: "helm",
      helm: {
        repoUrl: "https://kubernetes-sigs.github.io/metrics-server",
        chart: "metrics-server",
        version: "3.12.1",
      },
    },
    pruneEnabled: false,
    discoveredMeta: {
      catalogItem: "cat-metrics-server",
      releaseName: "metrics-server",
      namespace: "kube-system",
      detectedVersion: "3.12.1",
      chart: "metrics-server",
    },
    createdAt: iso(now - 5 * 86_400_000),
    updatedAt: iso(now - 60_000),
  };
  const discoveredIngress: MockAddon = {
    id: "addon-disc-ingress-nginx",
    orgId: "acme",
    clusterId: "cl-kind-dev",
    catalogItem: "cat-ingress-nginx",
    state: "discovered",
    deployMode: "application",
    source: {
      kind: "helm",
      helm: {
        repoUrl: "https://kubernetes.github.io/ingress-nginx",
        chart: "ingress-nginx",
        version: "4.11.3",
      },
    },
    pruneEnabled: false,
    discoveredMeta: {
      catalogItem: "cat-ingress-nginx",
      releaseName: "ingress-nginx",
      namespace: "ingress-nginx",
      detectedVersion: "4.11.3",
      chart: "ingress-nginx",
    },
    createdAt: iso(now - 5 * 86_400_000),
    updatedAt: iso(now - 120_000),
  };
  return {
    addons: {
      acme: [
        managedCertManager,
        managedExternalSecrets,
        managedExternalDns,
        fleetArgocd,
        failedIstio,
        fleetMonitoring,
        discoveredMetricsServer,
        discoveredIngress,
      ],
      globex: [],
    },
  };
}

let state: AddonsMockState = seedState();
let shaCounter = 0;
const nextSha = () =>
  `f4ce${String(++shaCounter).padStart(4, "0")}00000000000000000000000000000000`.slice(0, 40);

export const addonsMockControl = {
  reset() {
    state = seedState();
  },
  getState(): AddonsMockState {
    return state;
  },
};

export function addonsFor(org: string): MockAddon[] {
  return state.addons[org] ?? [];
}

export function findAddon(org: string, id: string): MockAddon | null {
  return addonsFor(org).find((a) => a.id === id) ?? null;
}

// Server-side list semantics (decision 8): per-cluster rows plus fleet rows
// whose selector equality-matches the cluster's labels; empty selector = all.
export function addonsForCluster(
  org: string,
  clusterId: string,
  clusterLabels: Record<string, string>,
): MockAddon[] {
  return addonsFor(org).filter((a) => {
    if (a.clusterId === clusterId) return true;
    if (a.clusterId !== "*") return false;
    return Object.entries(a.clusterSelector ?? {}).every(([k, v]) => clusterLabels[k] === v);
  });
}

export interface AdoptAddonBody {
  repoId?: string;
  version?: string;
  values?: Record<string, unknown>;
  deployMode?: AddonDeployMode;
  clusterSelector?: Record<string, string>;
  namespace?: string;
}

export function adoptAddonMock(
  org: string,
  clusterId: string,
  catalogItem: string,
  body: AdoptAddonBody,
  defaultRepoId: string,
  prPolicy: boolean,
): MockAddon | "already_managed" | "not_found" {
  const existing = addonsFor(org).find(
    (a) => a.clusterId === clusterId && a.catalogItem === catalogItem,
  );
  if (!existing) return "not_found";
  if (existing.state !== "discovered") return "already_managed";
  const nowIso = new Date().toISOString();
  const fleet = body.deployMode === "applicationset";
  existing.state = "managed";
  existing.deployMode = body.deployMode ?? "application";
  // Fleet-wide adoptions become "*" rows (plan §6 data model); they stay
  // visible on this cluster via selector matching in addonsForCluster.
  if (fleet) existing.clusterId = "*";
  existing.repoId = body.repoId || defaultRepoId;
  existing.repoPath = `addons/${existing.source.helm.chart}`;
  existing.chartVersion = body.version ?? existing.source.helm.version;
  existing.source.helm.version = existing.chartVersion;
  existing.values = body.values ?? {};
  existing.argocdApp = fleet ? `inari-addonset-${existing.id}` : `inari-addon-${existing.id}`;
  existing.clusterSelector = fleet ? (body.clusterSelector ?? {}) : undefined;
  existing.namespace = body.namespace ?? existing.discoveredMeta?.namespace as string | undefined;
  existing.health = "Progressing";
  existing.sync = "OutOfSync";
  // Decision 2: adopted addons register with prune OFF until a human flips it.
  existing.pruneEnabled = false;
  existing.discoveredMeta = undefined;
  existing.availableVersions = CERT_MANAGER_VERSIONS;
  if (prPolicy) {
    existing.prUrl = `https://github.com/acme/inari-state/pull/101`;
    existing.commitSha = undefined;
  } else {
    existing.commitSha = nextSha();
    existing.prUrl = undefined;
  }
  existing.updatedAt = nowIso;
  return existing;
}

export interface UpdateAddonBody {
  chartVersion?: string;
  values?: Record<string, unknown>;
}

export function updateAddonMock(
  org: string,
  id: string,
  body: UpdateAddonBody,
  prPolicy: boolean,
): MockAddon | null {
  const row = findAddon(org, id);
  if (!row) return null;
  if (body.chartVersion !== undefined) {
    row.chartVersion = body.chartVersion;
    row.source.helm.version = body.chartVersion;
  }
  if (body.values !== undefined) row.values = body.values;
  if (prPolicy) {
    row.prUrl = `https://github.com/acme/team-alpha-gitops/pull/43`;
    row.commitSha = undefined;
  } else {
    row.commitSha = nextSha();
    row.prUrl = undefined;
  }
  row.updatedAt = new Date().toISOString();
  return row;
}

export function enablePruneMock(org: string, id: string): MockAddon | "conflict" | null {
  const row = findAddon(org, id);
  if (!row) return null;
  if (row.pruneEnabled || row.state === "discovered") return "conflict";
  row.pruneEnabled = true;
  row.updatedAt = new Date().toISOString();
  return row;
}
