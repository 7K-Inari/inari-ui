import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Cluster addons (Feature C, M3W2): the console lists discovered + managed
// addons per cluster, adopts discovered releases into GitOps, edits
// version/values (committed direct or via PR), and enables prune explicitly.
//
// TODO(contract-sync): the pinned OpenAPI snapshot does not yet include the
// addons paths. The wire shapes below mirror the M3W2 contract
// (inari-server internal/types.ClusterAddon, internal/addons/http.go);
// after `npm run sync:api -- <m3w2-server-version>` replace them with
// components["schemas"][...] imports from @/api/__generated__/schema.

export type AddonState = "discovered" | "adopting" | "managed" | "update_failed";
export type AddonDeployMode = "application" | "applicationset";
export type AddonSourceKind = "helm" | "kro" | "crossplane" | "manifests" | "kustomize";

export interface WireHelmSource {
  repoUrl: string;
  chart: string;
  version: string;
  valuesRef?: string;
}

interface WireSourceDescriptor {
  kind: AddonSourceKind;
  helm?: WireHelmSource;
  kro?: { rgdRef: string; instance?: unknown };
  crossplane?: { manifests?: unknown };
  manifests?: { inline?: unknown; params?: Record<string, string> };
  kustomize?: { path: string; overlays?: string[] };
}

interface WireClusterAddon {
  id: string;
  orgId: string;
  // "*" marks fleet rows deployed via an ApplicationSet.
  clusterId: string;
  catalogItem: string;
  state: AddonState;
  deployMode: AddonDeployMode;
  repoId?: string;
  repoPath?: string;
  source: WireSourceDescriptor;
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
  createdAt: string;
  updatedAt: string;
}

// List rows carry the catalog's available versions for the edit dropdown.
interface WireAddonView extends WireClusterAddon {
  availableVersions?: string[];
}

interface WireListClusterAddonsOutputBody {
  addons?: WireAddonView[];
}

// Adopt, update, and enable-prune share one response shape.
interface WireAddonMutationOutputBody {
  addon: WireClusterAddon;
  commitSha?: string;
  prUrl?: string;
}

export interface AddonDiscoveredMeta {
  releaseName: string | null;
  namespace: string | null;
  detectedVersion: string | null;
  chart: string | null;
}

export interface AddonViewModel {
  id: string;
  orgId: string;
  clusterId: string;
  isFleet: boolean;
  catalogItem: string;
  state: AddonState;
  deployMode: AddonDeployMode;
  repoId: string | null;
  repoPath: string | null;
  sourceKind: AddonSourceKind;
  helm: WireHelmSource | null;
  chartVersion: string | null;
  values: Record<string, unknown>;
  argocdApp: string | null;
  health: string | null;
  sync: string | null;
  commitSha: string | null;
  prUrl: string | null;
  pruneEnabled: boolean;
  namespace: string | null;
  clusterSelector: Record<string, string>;
  discovered: AddonDiscoveredMeta | null;
  availableVersions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdoptAddonInput {
  // Empty = the cluster's bound baseline repo.
  repoId?: string;
  // Empty = the catalog's effective pin / latest stable.
  version?: string;
  values?: Record<string, unknown>;
  deployMode?: AddonDeployMode;
  // applicationset mode only: equality match against cluster labels,
  // evaluated server-side by Inari (decision 8). Empty = all org clusters.
  clusterSelector?: Record<string, string>;
  namespace?: string;
}

export interface UpdateAddonInput {
  chartVersion?: string;
  values?: Record<string, unknown>;
}

export interface AddonMutationResult {
  addon: AddonViewModel;
  commitSha: string | null;
  prUrl: string | null;
}

function mapDiscoveredMeta(raw: Record<string, unknown> | undefined): AddonDiscoveredMeta | null {
  if (!raw) return null;
  const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
  return {
    releaseName: str(raw.releaseName),
    namespace: str(raw.namespace),
    detectedVersion: str(raw.detectedVersion),
    chart: str(raw.chart),
  };
}

function toViewModel(w: WireAddonView): AddonViewModel {
  return {
    id: w.id,
    orgId: w.orgId,
    clusterId: w.clusterId,
    isFleet: w.clusterId === "*",
    catalogItem: w.catalogItem,
    state: w.state,
    deployMode: w.deployMode,
    repoId: w.repoId ?? null,
    repoPath: w.repoPath ?? null,
    sourceKind: w.source.kind,
    helm: w.source.helm ?? null,
    chartVersion: w.chartVersion ?? null,
    values: w.values ?? {},
    argocdApp: w.argocdApp ?? null,
    health: w.health ?? null,
    sync: w.sync ?? null,
    commitSha: w.commitSha ?? null,
    prUrl: w.prUrl ?? null,
    pruneEnabled: w.pruneEnabled,
    namespace: w.namespace ?? null,
    clusterSelector: w.clusterSelector ?? {},
    discovered: mapDiscoveredMeta(w.discoveredMeta),
    availableVersions: w.availableVersions ?? [],
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

function toMutationResult(w: WireAddonMutationOutputBody): AddonMutationResult {
  return {
    addon: toViewModel(w.addon),
    commitSha: w.commitSha ?? null,
    prUrl: w.prUrl ?? null,
  };
}

function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

// Lists discovered + managed addons for a cluster. The server already folds
// in fleet (ApplicationSet) rows whose selector matches the cluster's labels.
export async function listClusterAddons(
  token: string | undefined,
  clusterId: string,
  tenant?: string,
): Promise<AddonViewModel[]> {
  const res = await apiFetch<WireListClusterAddonsOutputBody>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(clusterId)}/addons`,
    { token },
  );
  return (res.addons ?? []).map(toViewModel);
}

// Adopts a discovered addon into GitOps: renders the Application /
// ApplicationSet into the target repo and commits per the repo's policy
// (decision 2: registered with prune OFF until explicitly enabled).
export async function adoptAddon(
  token: string | undefined,
  clusterId: string,
  catalogItem: string,
  body: AdoptAddonInput,
  tenant?: string,
): Promise<AddonMutationResult> {
  const res = await apiFetch<WireAddonMutationOutputBody>(
    `${tenantPath(resolveTenant(tenant))}/clusters/${encodeURIComponent(clusterId)}/addons/${encodeURIComponent(catalogItem)}/adopt`,
    { token, method: "POST", body },
  );
  return toMutationResult(res);
}

// Re-renders and commits a version and/or values change (the CD loop). At
// least one field is required; the server answers 422 otherwise.
export async function updateAddon(
  token: string | undefined,
  addonId: string,
  body: UpdateAddonInput,
  tenant?: string,
): Promise<AddonMutationResult> {
  const res = await apiFetch<WireAddonMutationOutputBody>(
    `${tenantPath(resolveTenant(tenant))}/addons/${encodeURIComponent(addonId)}`,
    { token, method: "PATCH", body },
  );
  return toMutationResult(res);
}

// Explicit human action (decision 2): turns ArgoCD prune on for one addon.
// 409 when already enabled or not managed.
export async function enableAddonPrune(
  token: string | undefined,
  addonId: string,
  tenant?: string,
): Promise<AddonMutationResult> {
  const res = await apiFetch<WireAddonMutationOutputBody>(
    `${tenantPath(resolveTenant(tenant))}/addons/${encodeURIComponent(addonId)}/enable-prune`,
    { token, method: "POST" },
  );
  return toMutationResult(res);
}

export interface PartitionedAddons {
  managed: AddonViewModel[];
  discovered: AddonViewModel[];
}

export function partitionAddons(addons: AddonViewModel[]): PartitionedAddons {
  const managed: AddonViewModel[] = [];
  const discovered: AddonViewModel[] = [];
  for (const a of addons) {
    (a.state === "discovered" ? discovered : managed).push(a);
  }
  return { managed, discovered };
}
