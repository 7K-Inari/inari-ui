import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { listCatalogItems } from "@/api/catalog";
import type { CatalogFilters } from "@/api/catalog";
import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import type { CatalogItemSummary, CatalogSort, CatalogSource } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CatalogViewMode } from "@/components/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/catalog/catalog-filter-bar";
import { CatalogCardSlots } from "@/ext/slots";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const SOURCE_BADGE: Record<CatalogSource, { label: string; variant: "default" | "secondary" | "warning" }> = {
  curated: { label: "Curated", variant: "default" },
  discovered: { label: "Discovered", variant: "secondary" },
  platform: { label: "Platform", variant: "warning" },
  template: { label: "Template", variant: "secondary" },
};

// Unknown/future sources must never crash the page (the catalog is a
// projection of the server; new sources land there first).
const SOURCE_BADGE_FALLBACK = { label: "Unknown", variant: "secondary" as const };

function sourceBadge(source: string) {
  return SOURCE_BADGE[source as CatalogSource] ?? SOURCE_BADGE_FALLBACK;
}

const PAGE_SIZE = 24;
const SORTS: CatalogSort[] = ["name", "name-desc", "newest", "oldest"];
const SOURCES: CatalogSource[] = ["curated", "discovered", "platform", "template"];

// Filter/sort/view state lives in the URL so filtered views are shareable
// and survive navigation.
function readParams(params: URLSearchParams) {
  const source = params.get("source");
  const sort = params.get("sort");
  const view = params.get("view");
  const page = Number(params.get("page") ?? "0");
  return {
    q: params.get("q") ?? "",
    source: (SOURCES.includes(source as CatalogSource) ? source : "all") as CatalogSource | "all",
    category: params.get("category") ?? "",
    cluster: params.get("cluster") ?? "",
    sort: (SORTS.includes(sort as CatalogSort) ? sort : "name") as CatalogSort,
    view: (view === "list" ? "list" : "grid") as CatalogViewMode,
    page: Number.isInteger(page) && page > 0 ? page : 0,
  };
}

export function CatalogBrowsePage() {
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readParams(searchParams);

  const filters: CatalogFilters = {
    q: state.q || undefined,
    source: state.source === "all" ? undefined : state.source,
    category: state.category || undefined,
    cluster: state.cluster || undefined,
    sort: state.sort,
    limit: PAGE_SIZE,
    offset: state.page * PAGE_SIZE,
  };

  const result = useAsyncResource(
    (token) => listCatalogItems(token, tenant, filters),
    [tenant, state.q, state.source, state.category, state.cluster, state.sort, state.page],
  );

  // Facet options come from an unfiltered listing so selecting a filter
  // doesn't collapse the choices. Clusters feed the compatibility filter.
  const facets = useAsyncResource((token) => listCatalogItems(token, tenant, {}), [tenant]);
  const clusters = useAsyncResource((token) => listClusters(token, tenant), [tenant]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const i of facets.data?.items ?? []) {
      if (i.category) set.add(i.category);
    }
    return [...set].sort();
  }, [facets.data]);

  // Stable identity: the filter bar's debounce effect depends on onChange,
  // so an unstable callback would reset the debounce on every parent render.
  const update = React.useCallback((patch: Partial<ReturnType<typeof readParams>>) => {
    const next = { ...readParams(searchParams), ...patch };
    // Any filter/sort change resets pagination; view/page changes keep it.
    if (!("page" in patch) && !("view" in patch)) next.page = 0;
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.source !== "all") params.set("source", next.source);
    if (next.category) params.set("category", next.category);
    if (next.cluster) params.set("cluster", next.cluster);
    if (next.sort !== "name") params.set("sort", next.sort);
    if (next.view !== "grid") params.set("view", next.view);
    if (next.page > 0) params.set("page", String(next.page));
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const items = result.data?.items ?? [];
  const total = result.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(state.page, pageCount - 1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Curated packages, discovered capabilities, and platform apps available to this scope.
        </p>
      </div>

      <CatalogFilterBar
        q={state.q}
        source={state.source}
        category={state.category}
        cluster={state.cluster}
        sort={state.sort}
        view={state.view}
        categories={categories}
        clusters={clusters.data ?? []}
        onChange={update}
        onClear={() => setSearchParams(new URLSearchParams())}
      />

      {result.error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load catalog: {result.error.message}
          </CardContent>
        </Card>
      )}

      {!result.error && result.loading && !result.data && (
        <p className="text-sm text-muted-foreground">Loading catalog…</p>
      )}

      {result.data && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p>No catalog items match the current filters.</p>
            {state.category && state.cluster && (
              <p className="mt-2">
                Discovered capabilities have no category; clear the category filter to see what
                this cluster already provides.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {items.length > 0 && state.view === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CatalogCard key={item.id} item={item} tenant={tenant} />
          ))}
        </div>
      )}

      {items.length > 0 && state.view === "list" && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Latest version</th>
                  <th className="px-4 py-2 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Link
                        to={tenantLink(tenant, `catalog/${item.id}`)}
                        className="font-medium hover:underline"
                      >
                        {item.displayName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={sourceBadge(item.source).variant}>
                        {sourceBadge(item.source).label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{item.category || "—"}</td>
                    <td className="px-4 py-2">
                      {item.latestVersion ? `v${item.latestVersion}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {item.createdAt ? formatRelative(item.createdAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage + 1} of {pageCount} ({total} items)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => update({ page: currentPage - 1 })}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= pageCount - 1}
              onClick={() => update({ page: currentPage + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogCard({ item, tenant }: { item: CatalogItemSummary; tenant: string }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            <Link to={tenantLink(tenant, `catalog/${item.id}`)} className="hover:underline">
              {item.displayName}
            </Link>
          </CardTitle>
          <Badge variant={sourceBadge(item.source).variant}>{sourceBadge(item.source).label}</Badge>
        </div>
        <CardDescription>{item.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-wrap items-center gap-2 pt-0 text-xs text-muted-foreground">
        {item.category && <Badge variant="muted">{item.category}</Badge>}
        {item.latestVersion ? (
          <>
            <span>v{item.latestVersion}</span>
            {item.latestChannel && <Badge variant="muted">{item.latestChannel}</Badge>}
          </>
        ) : (
          <span aria-label="no version published">—</span>
        )}
        <CatalogCardSlots item={item} />
      </CardContent>
    </Card>
  );
}
