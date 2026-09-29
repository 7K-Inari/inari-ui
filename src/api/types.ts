export type ClusterStatus =
  | "pending"
  | "pending_approval"
  | "connected"
  | "degraded"
  | "cordoned"
  | "revoked"
  | "decommissioned"
  | "disconnected";

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

export type CatalogSource = "curated" | "discovered" | "platform" | "template";

// Template identity scope (W6): "user" templates commit as the runner's
// per-user git social login; "platform" templates commit as the platform
// App/bot. Absent on the wire means the pre-W6 behavior (platform).
export type TemplateScope = "user" | "platform";

export type CommitIdentityKind = "user" | "platform_app";

// Metadata-only: provider/login identify the committer; tokens never leave
// the server.
export interface CommitIdentity {
  kind: CommitIdentityKind;
  provider: string | null;
  login: string | null;
}

// Tenant fallback policy for user-scope templates without a connected git
// account: platform_app = fall back to the platform App (audited);
// block = reject with 409.
export type TemplateFallbackPolicy = "platform_app" | "block";

// Sort values accepted by the browse API (whitelisted server-side).
export type CatalogSort = "name" | "name-desc" | "newest" | "oldest";

export interface CatalogItemSummary {
  id: string;
  name: string;
  displayName: string;
  description: string;
  source: CatalogSource;
  // Package category facet; empty for uncategorized and discovered items.
  category: string;
  createdAt: string | null;
  latestVersion: string | null;
  latestChannel: string | null;
  // Present only when the server payload carries a template identity scope.
  scope?: TemplateScope;
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
  updatedAt: string;
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
    helmCommand: string;
  };
}
