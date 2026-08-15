export type ClusterStatus = "pending" | "connected" | "degraded" | "disconnected";

export type ManagementMode = "adopt" | "observe" | "ignore";

export interface ClusterSummary {
  id: string;
  name: string;
  tenant: string;
  status: ClusterStatus;
  k8sVersion: string | null;
  labels: Record<string, string>;
  capabilityCount: number;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface ClusterDetail extends ClusterSummary {
  description?: string;
  agentVersion: string | null;
}

export type CapabilityKind =
  | "crd"
  | "olm-csv"
  | "xrd"
  | "crossplane-provider"
  | "helm-release"
  | "kro-rgd";

export interface Capability {
  id: string;
  kind: CapabilityKind;
  name: string;
  group: string;
  version: string;
  managementMode: ManagementMode;
  updatedAt: string;
}

export type CatalogSource = "curated" | "discovered" | "platform";

export interface CatalogItemSummary {
  id: string;
  name: string;
  displayName: string;
  description: string;
  source: CatalogSource;
  category: string;
  latestVersion: string;
  compatibleClusterIds: string[] | null;
}

export interface CatalogVersion {
  version: string;
  channel: string;
  deprecated: boolean;
  releasedAt: string;
}

export interface UiHints {
  [path: string]: {
    label?: string;
    description?: string;
    hidden?: boolean;
    widget?: string;
    options?: { label: string; value: string }[];
    order?: string[];
  };
}

export interface LockedField {
  path: string;
  value: unknown;
  reason?: string;
}

export interface PolicySummary {
  gitopsMode: "pull-request" | "direct-commit";
  approvalRequired: boolean;
  lockedFields: LockedField[];
  notes: string[];
}

export interface CatalogItemDetail extends CatalogItemSummary {
  docs: string;
  versions: CatalogVersion[];
  schema: Record<string, unknown>;
  uiHints: UiHints;
  policy: PolicySummary;
}

export type DeployPhase =
  | "pending"
  | "rendering"
  | "committing"
  | "syncing"
  | "healthy"
  | "degraded"
  | "failed";

export interface CreateDeployRequest {
  itemId: string;
  version: string;
  clusterId: string;
  name: string;
  spec: Record<string, unknown>;
}

export interface Deploy {
  id: string;
  tenant: string;
  itemId: string;
  version: string;
  clusterId: string;
  name: string;
  phase: DeployPhase;
  gitopsMode: "pull-request" | "direct-commit";
  prUrl: string | null;
  instanceId: string | null;
  message: string | null;
  createdAt: string;
}

export type ResourceHealth = "healthy" | "progressing" | "degraded" | "unknown";

export interface ResourceInstanceSummary {
  id: string;
  name: string;
  tenant: string;
  catalogItemId: string;
  catalogItemName: string;
  version: string;
  clusterId: string;
  clusterName: string;
  health: ResourceHealth;
  status: string;
  ownerTeam: string;
  updateAvailable: { from: string; to: string } | null;
  createdAt: string;
}

export interface ComposedResource {
  kind: string;
  name: string;
  namespace: string;
  health: ResourceHealth;
  status: string;
}

export interface ResourceInstanceDetail extends ResourceInstanceSummary {
  spec: Record<string, unknown>;
  composedResources: ComposedResource[];
  argocdUrl: string | null;
}

export interface UpgradeDiff {
  from: string;
  to: string;
  currentManifest: string;
  upgradedManifest: string;
}

export interface CreateClusterRequest {
  name: string;
  description?: string;
  labels: Record<string, string>;
}

export interface CreateClusterResponse {
  cluster: ClusterDetail;
  registrationToken: string;
  tokenExpiresAt: string;
  install: {
    manifestYaml: string;
    helmCommand?: string;
  };
}
