import type {
  CatalogItemDetail,
  CatalogItemSummary,
  CreateDeployRequest,
  Deploy,
  DeployPhase,
  ResourceInstanceDetail,
  UpgradeDiff,
} from "@/api/types";

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

const postgresSchema: Record<string, unknown> = {
  type: "object",
  required: ["engine", "storageGi"],
  properties: {
    engine: { type: "string", title: "Engine version", default: "16" },
    storageGi: {
      type: "integer",
      title: "Storage (Gi)",
      minimum: 10,
      maximum: 1000,
      default: 50,
    },
    highAvailability: { type: "boolean", title: "High availability", default: false },
    backupSchedule: { type: "string", title: "Backup schedule (cron)" },
    instanceClass: {
      type: "string",
      title: "Instance class",
      enum: ["db.t3.medium", "db.r6g.large"],
      default: "db.t3.medium",
    },
  },
};

const postgresDetail: CatalogItemDetail = {
  id: "cat-postgresql-aws",
  name: "postgresql-aws",
  displayName: "PostgreSQL on AWS",
  description: "Managed PostgreSQL via Crossplane RDS with backups and optional HA.",
  source: "curated",
  category: "database",
  latestVersion: "1.4.0",
  compatibleClusterIds: null,
  docs: [
    "# PostgreSQL on AWS",
    "",
    "Provisions an RDS instance in the tenant AWS account via Crossplane.",
    "",
    "- Automated daily backups",
    "- Optional multi-AZ high availability",
    "- Connection secret synced via External Secrets",
  ].join("\n"),
  versions: [
    { version: "1.4.0", channel: "stable", deprecated: false, releasedAt: iso(now - 5 * 86_400_000) },
    { version: "1.3.0", channel: "stable", deprecated: false, releasedAt: iso(now - 40 * 86_400_000) },
    { version: "1.2.1", channel: "stable", deprecated: true, releasedAt: iso(now - 90 * 86_400_000) },
  ],
  schema: postgresSchema,
  uiHints: {
    "engine": { label: "PostgreSQL engine version", order: ["engine", "storageGi", "highAvailability", "instanceClass", "backupSchedule"] },
    "backupSchedule": { widget: "textarea", description: "Cron expression, e.g. 0 2 * * *" },
  },
  policy: {
    gitopsMode: "pull-request",
    approvalRequired: false,
    lockedFields: [
      { path: "instanceClass", value: "db.t3.medium", reason: "Cost guardrail: larger classes require platform approval" },
    ],
    notes: ["Deploys open a pull request in the acme-inari-state repository."],
  },
};

const certManagerDetail: CatalogItemDetail = {
  id: "cat-cert-manager",
  name: "cert-manager",
  displayName: "cert-manager",
  description: "Discovered OLM operator: TLS certificate automation.",
  source: "discovered",
  category: "security",
  latestVersion: "1.15.0",
  compatibleClusterIds: ["cl-kind-dev"],
  docs: "# cert-manager\n\nDiscovered on cluster kind-dev via OLM.",
  versions: [
    { version: "1.15.0", channel: "stable", deprecated: false, releasedAt: iso(now - 20 * 86_400_000) },
  ],
  schema: {
    type: "object",
    properties: {
      enableHA: { type: "boolean", title: "Enable HA", default: true },
    },
  },
  uiHints: {},
  policy: {
    gitopsMode: "direct-commit",
    approvalRequired: false,
    lockedFields: [],
    notes: [],
  },
};

const keycloakRealmDetail: CatalogItemDetail = {
  id: "cat-keycloak-realm",
  name: "keycloak-realm",
  displayName: "Keycloak Realm",
  description: "Platform-scoped tenant Keycloak realm reconciled by inari-operator.",
  source: "platform",
  category: "identity",
  latestVersion: "0.9.0",
  compatibleClusterIds: [],
  docs: "# Keycloak Realm\n\nSelf-service workload SSO realm for your tenant.",
  versions: [
    { version: "0.9.0", channel: "stable", deprecated: false, releasedAt: iso(now - 10 * 86_400_000) },
  ],
  schema: {
    type: "object",
    required: ["displayName"],
    properties: {
      displayName: { type: "string", title: "Display name" },
      sessionTimeoutMinutes: { type: "integer", title: "Session timeout (min)", default: 60 },
    },
  },
  uiHints: {},
  policy: {
    gitopsMode: "pull-request",
    approvalRequired: true,
    lockedFields: [],
    notes: ["Realm creation requires platform-admin approval."],
  },
};

export const catalogItems: CatalogItemDetail[] = [
  postgresDetail,
  certManagerDetail,
  keycloakRealmDetail,
];

const DEPLOY_PHASES: DeployPhase[] = ["pending", "rendering", "committing", "syncing", "healthy"];

interface DeployState extends Deploy {
  polls: number;
}

export interface CatalogMockState {
  deploys: DeployState[];
  resources: ResourceInstanceDetail[];
}

const seedResources: ResourceInstanceDetail[] = [
  {
    id: "ri-orders-db",
    name: "orders-db",
    tenant: "acme",
    catalogItemId: "cat-postgresql-aws",
    catalogItemName: "PostgreSQL on AWS",
    version: "1.3.0",
    clusterId: "cl-eks-prod",
    clusterName: "eks-prod-eu",
    health: "healthy",
    status: "Synced",
    ownerTeam: "orders-team",
    updateAvailable: { from: "1.3.0", to: "1.4.0" },
    createdAt: iso(now - 20 * 86_400_000),
    spec: { engine: "16", storageGi: 100, highAvailability: true, instanceClass: "db.t3.medium" },
    composedResources: [
      { kind: "RDSInstance", name: "orders-db", namespace: "crossplane-system", health: "healthy", status: "Available" },
      { kind: "ExternalSecret", name: "orders-db-conn", namespace: "orders", health: "healthy", status: "SecretSynced" },
    ],
    argocdUrl: "https://argocd.eks-prod-eu.example.com/applications/orders-db",
  },
  {
    id: "ri-payments-db",
    name: "payments-db",
    tenant: "acme",
    catalogItemId: "cat-postgresql-aws",
    catalogItemName: "PostgreSQL on AWS",
    version: "1.4.0",
    clusterId: "cl-kind-dev",
    clusterName: "kind-dev",
    health: "progressing",
    status: "Reconciling",
    ownerTeam: "payments-team",
    updateAvailable: null,
    createdAt: iso(now - 2 * 86_400_000),
    spec: { engine: "16", storageGi: 50, highAvailability: false, instanceClass: "db.t3.medium" },
    composedResources: [
      { kind: "RDSInstance", name: "payments-db", namespace: "crossplane-system", health: "progressing", status: "Creating" },
    ],
    argocdUrl: "https://argocd.kind-dev.example.com/applications/payments-db",
  },
  {
    id: "ri-globex-realm",
    name: "globex-apps",
    tenant: "globex",
    catalogItemId: "cat-keycloak-realm",
    catalogItemName: "Keycloak Realm",
    version: "0.9.0",
    clusterId: "cl-gke-staging",
    clusterName: "gke-staging",
    health: "degraded",
    status: "SyncFailed",
    ownerTeam: "identity-team",
    updateAvailable: null,
    createdAt: iso(now - 60 * 86_400_000),
    spec: { displayName: "Globex Apps" },
    composedResources: [],
    argocdUrl: null,
  },
];

function seedCatalogState(): CatalogMockState {
  return {
    deploys: [],
    resources: seedResources.map((r) => ({ ...r })),
  };
}

let state: CatalogMockState = seedCatalogState();

export const mockCatalogControl = {
  reset() {
    state = seedCatalogState();
  },
  getState(): CatalogMockState {
    return state;
  },
};

function toSummary(item: CatalogItemDetail): CatalogItemSummary {
  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    description: item.description,
    source: item.source,
    category: item.category,
    latestVersion: item.latestVersion,
    compatibleClusterIds: item.compatibleClusterIds,
  };
}

export function listCatalogItemsFiltered(filters: {
  source?: string | null;
  category?: string | null;
  clusterId?: string | null;
}): CatalogItemSummary[] {
  return catalogItems
    .filter((i) => !filters.source || i.source === filters.source)
    .filter((i) => !filters.category || i.category === filters.category)
    .filter(
      (i) =>
        !filters.clusterId ||
        i.compatibleClusterIds === null ||
        i.compatibleClusterIds.includes(filters.clusterId),
    )
    .map(toSummary);
}

export function findCatalogItem(id: string): CatalogItemDetail | undefined {
  return catalogItems.find((i) => i.id === id);
}

export function createDeployMock(tenant: string, body: CreateDeployRequest): Deploy {
  const item = findCatalogItem(body.itemId);
  const deploy: DeployState = {
    id: `dep-${Math.random().toString(36).slice(2, 10)}`,
    tenant,
    itemId: body.itemId,
    version: body.version,
    clusterId: body.clusterId,
    name: body.name,
    phase: "pending",
    gitopsMode: item?.policy.gitopsMode ?? "direct-commit",
    prUrl: null,
    instanceId: null,
    message: null,
    createdAt: new Date().toISOString(),
    polls: 0,
  };
  state.deploys.push(deploy);
  const rest = { ...deploy } as Partial<DeployState>;
  delete rest.polls;
  return rest as Deploy;
}

export function pollDeployMock(id: string): Deploy | undefined {
  const deploy = state.deploys.find((d) => d.id === id);
  if (!deploy) return undefined;
  deploy.polls += 1;
  const phaseIndex = Math.min(deploy.polls, DEPLOY_PHASES.length - 1);
  deploy.phase = DEPLOY_PHASES[phaseIndex];
  if (deploy.gitopsMode === "pull-request" && phaseIndex >= 2 && !deploy.prUrl) {
    deploy.prUrl = `https://github.com/acme/acme-inari-state/pull/${state.deploys.length + 100}`;
  }
  if (deploy.phase === "healthy" && !deploy.instanceId) {
    const item = findCatalogItem(deploy.itemId);
    const instanceId = `ri-${deploy.name}`;
    deploy.instanceId = instanceId;
    state.resources.push({
      id: instanceId,
      name: deploy.name,
      tenant: deploy.tenant,
      catalogItemId: deploy.itemId,
      catalogItemName: item?.displayName ?? deploy.itemId,
      version: deploy.version,
      clusterId: deploy.clusterId,
      clusterName: deploy.clusterId,
      health: "healthy",
      status: "Synced",
      ownerTeam: "unknown",
      updateAvailable: null,
      createdAt: new Date().toISOString(),
      spec: {},
      composedResources: [],
      argocdUrl: null,
    });
  }
  const rest = { ...deploy } as Partial<DeployState>;
  delete rest.polls;
  return rest as Deploy;
}

export function listResourcesForTenant(tenant: string | null): ResourceInstanceDetail[] {
  return state.resources.filter((r) => !tenant || r.tenant === tenant);
}

export function findResource(id: string): ResourceInstanceDetail | undefined {
  return state.resources.find((r) => r.id === id);
}

export function upgradeDiffFor(id: string, to: string): UpgradeDiff | undefined {
  const resource = findResource(id);
  if (!resource) return undefined;
  return {
    from: resource.version,
    to,
    currentManifest: [
      `apiVersion: kro.run/v1alpha1`,
      `kind: ${resource.catalogItemName}`,
      "metadata:",
      `  name: ${resource.name}`,
      "spec:",
      `  version: ${resource.version}`,
    ].join("\n"),
    upgradedManifest: [
      `apiVersion: kro.run/v1alpha1`,
      `kind: ${resource.catalogItemName}`,
      "metadata:",
      `  name: ${resource.name}`,
      "spec:",
      `  version: ${to}`,
    ].join("\n"),
  };
}

export function upgradeResourceMock(id: string, to: string): Deploy | undefined {
  const resource = findResource(id);
  if (!resource) return undefined;
  const deploy: DeployState = {
    id: `dep-${Math.random().toString(36).slice(2, 10)}`,
    tenant: resource.tenant,
    itemId: resource.catalogItemId,
    version: to,
    clusterId: resource.clusterId,
    name: resource.name,
    phase: "pending",
    gitopsMode: "pull-request",
    prUrl: null,
    instanceId: resource.id,
    message: null,
    createdAt: new Date().toISOString(),
    polls: 0,
  };
  state.deploys.push(deploy);
  resource.updateAvailable = null;
  const rest = { ...deploy } as Partial<DeployState>;
  delete rest.polls;
  return rest as Deploy;
}
