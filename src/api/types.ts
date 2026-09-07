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

export type ClusterDetail = ClusterSummary;

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
  latestVersion: string;
}

export interface CatalogVersion {
  version: string;
  channel: string;
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

export interface CatalogItemDetail extends CatalogItemSummary {
  versions: CatalogVersion[];
  schema: Record<string, unknown>;
  uiHints: UiHints;
  // Wire field `approvalPolicy` on ItemView ("auto" = no approval needed).
  approvalPolicy: string;
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
  health: ResourceHealth;
  status: string;
  ownerTeam: string;
  updateAvailable: { from: string; to: string } | null;
  createdAt: string;
}

export interface ResourceInstanceDetail extends ResourceInstanceSummary {
  spec: Record<string, unknown>;
}

export interface UpgradeDiff {
  from: string;
  to: string;
  currentManifest: string;
  upgradedManifest: string;
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
