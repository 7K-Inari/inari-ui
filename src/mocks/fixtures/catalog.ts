import type { components } from "@/api/__generated__/schema";
import type {
  CreateDeployRequest,
  Deploy,
  DeployPhase,
  UpgradeDiff,
} from "@/api/types";

// Fixtures speak the huma wire shapes (ItemView / CatalogItemVersion /
// InstanceView from the generated OpenAPI contract) so the MSW handlers can
// wrap them in the response envelopes without inventing fields the server
// never sends. The API mappers in @/api are the source of truth for what the
// UI ends up rendering.

type ItemView = components["schemas"]["ItemView"];
type CatalogItemVersion = components["schemas"]["CatalogItemVersion"];
type InstanceView = components["schemas"]["InstanceView"];

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

const postgresUiHints: Record<string, unknown> = {
  engine: { label: "PostgreSQL engine version", order: ["engine", "storageGi", "highAvailability", "instanceClass", "backupSchedule"] },
  backupSchedule: { widget: "textarea", description: "Cron expression, e.g. 0 2 * * *" },
};

function version(itemId: string, version: string, channel: string, schema?: unknown, uiHints?: unknown): CatalogItemVersion {
  return {
    id: `${itemId}-${version}`,
    itemId,
    version,
    channel,
    schema,
    uiHints,
  };
}

const postgresItem: ItemView = {
  id: "cat-postgresql-aws",
  name: "postgresql-aws",
  displayName: "PostgreSQL on AWS",
  description: "Managed PostgreSQL via Crossplane RDS with backups and optional HA.",
  source: "curated",
  approvalPolicy: "auto",
  pinnedVersion: "1.4.0",
  createdAt: iso(now - 120 * 86_400_000),
  versions: [
    version("cat-postgresql-aws", "1.4.0", "stable", postgresSchema, postgresUiHints),
    version("cat-postgresql-aws", "1.3.0", "stable"),
    version("cat-postgresql-aws", "1.2.1", "stable"),
  ],
};

const certManagerItem: ItemView = {
  id: "cat-cert-manager",
  name: "cert-manager",
  displayName: "cert-manager",
  description: "Discovered OLM operator: TLS certificate automation.",
  source: "discovered",
  approvalPolicy: "auto",
  pinnedVersion: "1.15.0",
  createdAt: iso(now - 60 * 86_400_000),
  versions: [
    version("cat-cert-manager", "1.15.0", "stable", {
      type: "object",
      properties: {
        enableHA: { type: "boolean", title: "Enable HA", default: true },
      },
    }),
  ],
};

const keycloakRealmItem: ItemView = {
  id: "cat-keycloak-realm",
  name: "keycloak-realm",
  displayName: "Keycloak Realm",
  description: "Platform-scoped tenant Keycloak realm reconciled by inari-operator.",
  source: "platform",
  approvalPolicy: "platform-admin",
  pinnedVersion: "0.9.0",
  createdAt: iso(now - 30 * 86_400_000),
  versions: [
    version("cat-keycloak-realm", "0.9.0", "stable", {
      type: "object",
      required: ["displayName"],
      properties: {
        displayName: { type: "string", title: "Display name" },
        sessionTimeoutMinutes: { type: "integer", title: "Session timeout (min)", default: 60 },
      },
    }),
  ],
};

const crossplaneItem: ItemView = {
  id: "cat-crossplane-eks",
  name: "crossplane-eks",
  displayName: "Crossplane EKS",
  description: "Discovered capability: EKS cluster provisioning (no package synced yet).",
  source: "discovered",
  approvalPolicy: "auto",
  createdAt: iso(now - 10 * 86_400_000),
  versions: null,
};

export const catalogItems: ItemView[] = [
  postgresItem,
  certManagerItem,
  keycloakRealmItem,
  crossplaneItem,
];

const DEPLOY_PHASES: DeployPhase[] = ["pending", "rendering", "committing", "syncing", "healthy"];

interface DeployState extends Deploy {
  polls: number;
}

export interface CatalogMockState {
  deploys: DeployState[];
  resources: InstanceView[];
}

function instance(partial: Partial<InstanceView> & Pick<InstanceView, "id" | "orgId" | "catalogItemId" | "version" | "clusterId" | "resourceRef">): InstanceView {
  return {
    health: "healthy",
    state: "Synced",
    ownerTeam: "",
    spec: {},
    generation: 1,
    managementMode: "adopt",
    newVersionAvailable: false,
    createdAt: iso(now - 86_400_000),
    updatedAt: iso(now - 86_400_000),
    ...partial,
  };
}

const seedResources: InstanceView[] = [
  instance({
    id: "ri-orders-db",
    orgId: "acme",
    catalogItemId: "cat-postgresql-aws",
    version: "1.3.0",
    latestVersion: "1.4.0",
    newVersionAvailable: true,
    clusterId: "cl-eks-prod",
    resourceRef: { kind: "RDSInstance", name: "orders-db", namespace: "orders" },
    health: "healthy",
    state: "Synced",
    ownerTeam: "orders-team",
    generation: 4,
    createdAt: iso(now - 20 * 86_400_000),
    spec: { engine: "16", storageGi: 100, highAvailability: true, instanceClass: "db.t3.medium" },
  }),
  instance({
    id: "ri-payments-db",
    orgId: "acme",
    catalogItemId: "cat-postgresql-aws",
    version: "1.4.0",
    clusterId: "cl-kind-dev",
    resourceRef: { kind: "RDSInstance", name: "payments-db", namespace: "payments" },
    health: "progressing",
    state: "Reconciling",
    ownerTeam: "payments-team",
    createdAt: iso(now - 2 * 86_400_000),
    spec: { engine: "16", storageGi: 50, highAvailability: false, instanceClass: "db.t3.medium" },
  }),
  instance({
    id: "ri-globex-realm",
    orgId: "globex",
    catalogItemId: "cat-keycloak-realm",
    version: "0.9.0",
    clusterId: "cl-gke-staging",
    resourceRef: { kind: "KeycloakRealm", name: "globex-apps", namespace: "identity" },
    health: "degraded",
    state: "SyncFailed",
    statusMessage: "Realm reconciliation failed: identity provider unreachable",
    ownerTeam: "identity-team",
    generation: 2,
    createdAt: iso(now - 60 * 86_400_000),
    spec: { displayName: "Globex Apps" },
  }),
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

export function listCatalogItemsFiltered(filters: {
  source?: string | null;
}): ItemView[] {
  return catalogItems.filter((i) => !filters.source || i.source === filters.source);
}

export function findCatalogItem(id: string): ItemView | undefined {
  return catalogItems.find((i) => i.id === id);
}

export function createDeployMock(tenant: string, body: CreateDeployRequest): Deploy {
  const deploy: DeployState = {
    id: `dep-${Math.random().toString(36).slice(2, 10)}`,
    tenant,
    itemId: body.itemId,
    version: body.version,
    clusterId: body.clusterId,
    name: body.name,
    phase: "pending",
    gitopsMode: "pull-request",
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

// InstanceView the server reports while a deploy is still progressing; the
// wizard polls GET /instances/{id} to watch it move to healthy.
export function instanceViewForDeploy(deploy: Deploy): InstanceView {
  return instance({
    id: deploy.id,
    orgId: deploy.tenant,
    catalogItemId: deploy.itemId,
    version: deploy.version,
    clusterId: deploy.clusterId,
    resourceRef: { kind: "Instance", name: deploy.name },
    health:
      deploy.phase === "healthy"
        ? "healthy"
        : deploy.phase === "failed"
          ? "degraded"
          : "progressing",
    state: deploy.phase,
    statusMessage: deploy.message ?? "",
    prUrl: deploy.prUrl ?? undefined,
    createdAt: deploy.createdAt,
  });
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
    const instanceId = `ri-${deploy.name}`;
    deploy.instanceId = instanceId;
    state.resources.push(
      instance({
        id: instanceId,
        orgId: deploy.tenant,
        catalogItemId: deploy.itemId,
        version: deploy.version,
        clusterId: deploy.clusterId,
        resourceRef: { kind: "Instance", name: deploy.name },
        ownerTeam: "unknown",
        createdAt: new Date().toISOString(),
        spec: {},
      }),
    );
  }
  const rest = { ...deploy } as Partial<DeployState>;
  delete rest.polls;
  return rest as Deploy;
}

export function listResourcesForTenant(tenant: string | null): InstanceView[] {
  return state.resources.filter((r) => !tenant || r.orgId === tenant);
}

export function findResource(id: string): InstanceView | undefined {
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
      `kind: ${resource.catalogItemId}`,
      "metadata:",
      `  name: ${resource.resourceRef.name}`,
      "spec:",
      `  version: ${resource.version}`,
    ].join("\n"),
    upgradedManifest: [
      `apiVersion: kro.run/v1alpha1`,
      `kind: ${resource.catalogItemId}`,
      "metadata:",
      `  name: ${resource.resourceRef.name}`,
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
    tenant: resource.orgId,
    itemId: resource.catalogItemId,
    version: to,
    clusterId: resource.clusterId,
    name: resource.resourceRef.name,
    phase: "pending",
    gitopsMode: "pull-request",
    prUrl: null,
    instanceId: resource.id,
    message: null,
    createdAt: new Date().toISOString(),
    polls: 0,
  };
  state.deploys.push(deploy);
  resource.newVersionAvailable = false;
  const rest = { ...deploy } as Partial<DeployState>;
  delete rest.polls;
  return rest as Deploy;
}
