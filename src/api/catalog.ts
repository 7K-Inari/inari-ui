import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import type {
  CatalogItemDetail,
  CatalogItemSummary,
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
  return {
    id: i.id,
    name: i.name,
    displayName: i.displayName || i.name,
    description: i.description ?? "",
    source: i.source as CatalogSource,
    latestVersion: i.pinnedVersion || versions[0]?.version || "",
  };
}

function mapItemDetail(i: ServerCatalogItem): CatalogItemDetail {
  const base = mapItem(i);
  const versions = (i.versions ?? []).map(mapVersion);
  const latest = (i.versions ?? [])[0];
  return {
    ...base,
    versions,
    schema: (latest?.schema ?? {}) as Record<string, unknown>,
    uiHints: (latest?.uiHints ?? {}) as UiHints,
    approvalPolicy: i.approvalPolicy,
  };
}

export interface CatalogFilters {
  source?: CatalogSource;
}

export async function listCatalogItems(
  token: string | undefined,
  tenant: string,
  filters: CatalogFilters = {},
): Promise<CatalogItemSummary[]> {
  const res = await apiFetch<ListCatalogResponse>(
    `${tenantPath(resolveTenant(tenant))}/catalog`,
    { token },
  );
  let items = (res.items ?? []).map(mapItem);
  // Server-side filter params don't exist yet; filter client-side.
  if (filters.source) items = items.filter((i) => i.source === filters.source);
  return items;
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
