import { apiFetch } from "@/api/client";
import type { CatalogItemDetail, CatalogItemSummary, CatalogSource } from "@/api/types";
import { ALL_TENANTS } from "@/tenant/tenant-link";

export interface CatalogFilters {
  clusterId?: string;
  category?: string;
  source?: CatalogSource;
}

export function listCatalogItems(
  token: string | undefined,
  tenant: string,
  filters: CatalogFilters = {},
) {
  const params = new URLSearchParams();
  if (tenant !== ALL_TENANTS) params.set("tenant", tenant);
  if (filters.clusterId) params.set("clusterId", filters.clusterId);
  if (filters.category) params.set("category", filters.category);
  if (filters.source) params.set("source", filters.source);
  const qs = params.toString();
  return apiFetch<CatalogItemSummary[]>(`/catalog/items${qs ? `?${qs}` : ""}`, { token });
}

export function getCatalogItem(token: string | undefined, id: string) {
  return apiFetch<CatalogItemDetail>(`/catalog/items/${encodeURIComponent(id)}`, { token });
}
