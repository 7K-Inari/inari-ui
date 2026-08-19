import { apiFetch } from "@/api/client";
import type {
  CatalogItemDetail,
  CatalogItemSummary,
  CatalogSource,
  CatalogVersion,
  PolicySummary,
  UiHints,
} from "@/api/types";
import { resolveTenant } from "@/tenant/current";

// Server REST surface: /api/v1/tenants/{org}/catalog...
function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

interface ServerCatalogItemVersion {
  id: string;
  itemId: string;
  version: string;
  channel?: string;
  deprecated?: boolean;
  releasedAt?: string;
  schema?: Record<string, unknown>;
  uiHints?: UiHints;
}

interface ServerCatalogItem {
  id: string;
  source: CatalogSource;
  name: string;
  displayName?: string;
  description?: string;
  category?: string;
  docs?: string;
  gitopsPolicy?: "pull-request" | "direct-commit";
  lockedFields?: PolicySummary["lockedFields"];
  policyNotes?: string[];
  approvalPolicy?: string;
  createdAt?: string;
  versions?: ServerCatalogItemVersion[];
  pinnedVersion?: string;
  compatibleClusterIds?: string[] | null;
}

function mapVersion(v: ServerCatalogItemVersion): CatalogVersion {
  return {
    version: v.version,
    channel: v.channel ?? "stable",
    deprecated: v.deprecated ?? false,
    releasedAt: v.releasedAt ?? "",
  };
}

function mapItem(i: ServerCatalogItem): CatalogItemSummary {
  const versions = i.versions ?? [];
  return {
    id: i.id,
    name: i.name,
    displayName: i.displayName || i.name,
    description: i.description ?? "",
    source: i.source,
    category: i.category ?? i.source, // server has no category field yet; fall back to source
    latestVersion: i.pinnedVersion || versions[0]?.version || "",
    compatibleClusterIds: i.compatibleClusterIds ?? null,
  };
}

function mapItemDetail(i: ServerCatalogItem): CatalogItemDetail {
  const base = mapItem(i);
  const versions = (i.versions ?? []).map(mapVersion);
  const latest = (i.versions ?? [])[0];
  const policy: PolicySummary = {
    gitopsMode: i.gitopsPolicy ?? "direct-commit", // default; tenant git policy refines at deploy time
    approvalRequired: (i.approvalPolicy ?? "auto") !== "auto",
    lockedFields: i.lockedFields ?? [],
    notes: i.policyNotes ?? [],
  };
  return {
    ...base,
    docs: i.docs ?? "",
    versions,
    schema: latest?.schema ?? {},
    uiHints: latest?.uiHints ?? {},
    policy,
  };
}

export interface CatalogFilters {
  clusterId?: string;
  category?: string;
  source?: CatalogSource;
}

export async function listCatalogItems(
  token: string | undefined,
  tenant: string,
  filters: CatalogFilters = {},
): Promise<CatalogItemSummary[]> {
  const res = await apiFetch<{ items: ServerCatalogItem[] | null }>(
    `${tenantPath(resolveTenant(tenant))}/catalog`,
    { token },
  );
  let items = (res.items ?? []).map(mapItem);
  // Server-side filter params don't exist yet; filter client-side.
  if (filters.source) items = items.filter((i) => i.source === filters.source);
  if (filters.category) items = items.filter((i) => i.category === filters.category);
  if (filters.clusterId) {
    items = items.filter(
      (i) => i.compatibleClusterIds === null || i.compatibleClusterIds.includes(filters.clusterId!),
    );
  }
  return items;
}

export async function getCatalogItem(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<CatalogItemDetail> {
  const res = await apiFetch<{ item: ServerCatalogItem }>(
    `${tenantPath(resolveTenant(tenant))}/catalog/${encodeURIComponent(id)}`,
    { token },
  );
  return mapItemDetail(res.item);
}
