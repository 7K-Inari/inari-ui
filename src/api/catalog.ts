import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import type {
  CatalogItemDetail,
  CatalogItemSummary,
  CatalogSort,
  CatalogSource,
  CatalogVersion,
  UiHints,
} from "@/api/types";
import { resolveTenant } from "@/tenant/current";

// Server REST surface: /api/v1/tenants/{org}/catalog...
// Server shapes come from the huma-generated OpenAPI contract (pinned snapshot
// in openapi/openapi.yaml); UI view models stay in @/api/types.
function tenantPath(tenant: string): string {
  return `/tenants/${encodeURIComponent(tenant)}`;
}

type ServerCatalogItemVersion = components["schemas"]["CatalogItemVersion"];
type ServerCatalogItem = components["schemas"]["ItemView"];
type ListCatalogResponse = components["schemas"]["ListCatalogOutputBody"];
type CatalogItemResponse = components["schemas"]["ItemOutputBody"];

function mapVersion(v: ServerCatalogItemVersion): CatalogVersion {
  return {
    version: v.version,
    channel: v.channel ?? "stable",
  };
}

function mapItem(i: ServerCatalogItem): CatalogItemSummary {
  const versions = i.versions ?? [];
  const pinned = i.pinnedVersion
    ? versions.find((v) => v.version === i.pinnedVersion)
    : undefined;
  const latest = pinned ?? versions.find((v) => v.channel === "stable") ?? versions[versions.length - 1];
  return {
    id: i.id,
    name: i.name,
    displayName: i.displayName || i.name,
    description: i.description ?? "",
    source: i.source as CatalogSource,
    category: i.category ?? "",
    createdAt: i.createdAt ?? null,
    latestVersion: latest?.version ?? null,
    latestChannel: latest?.channel ?? null,
  };
}

function mapItemDetail(i: ServerCatalogItem): CatalogItemDetail {
  const base = mapItem(i);
  const versions = (i.versions ?? []).map(mapVersion);
  // The server returns versions ascending by version string, so index 0 is
  // the OLDEST; pick the version matching mapItem's latest selection
  // (pinned → stable channel → last), else the highest one.
  const all = i.versions ?? [];
  const latest =
    all.find((v) => v.version === base.latestVersion) ?? all[all.length - 1];
  return {
    ...base,
    versions,
    schema: (latest?.schema ?? {}) as Record<string, unknown>,
    uiHints: (latest?.uiHints ?? {}) as UiHints,
    approvalPolicy: i.approvalPolicy,
  };
}

export interface CatalogFilters {
  q?: string;
  source?: CatalogSource;
  category?: string;
  cluster?: string;
  sort?: CatalogSort;
  limit?: number;
  offset?: number;
}

export interface CatalogListResult {
  items: CatalogItemSummary[];
  total: number;
}

function catalogQuery(filters: CatalogFilters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.source) p.set("source", filters.source);
  if (filters.category) p.set("category", filters.category);
  if (filters.cluster) p.set("cluster", filters.cluster);
  if (filters.sort && filters.sort !== "name") p.set("sort", filters.sort);
  if (filters.limit) p.set("limit", String(filters.limit));
  if (filters.offset) p.set("offset", String(filters.offset));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listCatalogItems(
  token: string | undefined,
  tenant: string,
  filters: CatalogFilters = {},
): Promise<CatalogListResult> {
  const res = await apiFetch<ListCatalogResponse>(
    `${tenantPath(resolveTenant(tenant))}/catalog${catalogQuery(filters)}`,
    { token },
  );
  return { items: (res.items ?? []).map(mapItem), total: res.total };
}

export async function getCatalogItem(
  token: string | undefined,
  id: string,
  tenant?: string,
): Promise<CatalogItemDetail> {
  const res = await apiFetch<CatalogItemResponse>(
    `${tenantPath(resolveTenant(tenant))}/catalog/${encodeURIComponent(id)}`,
    { token },
  );
  return mapItemDetail(res.item);
}
