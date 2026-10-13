import * as React from "react";
import { LayoutGrid, List } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { listCatalogItems } from "@/api/catalog";
import type { CatalogFilters } from "@/api/catalog";
import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import type { CatalogItemSummary, CatalogSort, CatalogSource } from "@/api/types";
import { Alert, Card, Skeleton } from "7k-design-system/react";

import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { TemplateScopeBadge } from "@/components/templates/template-scope-badge";
import { CatalogCardSlots } from "@/ext/slots";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

// Source is not machine state — neutral tag styling everywhere (design §2).
const SOURCE_LABEL: Record<CatalogSource, string> = {
  curated: "Curated",
  discovered: "Discovered",
  platform: "Platform",
  template: "Template",
};

// Unknown/future sources must never crash the page (the catalog is a
// projection of the server; new sources land there first).
function sourceLabel(source: string) {
  return SOURCE_LABEL[source as CatalogSource] ?? "Unknown";
}

type CatalogViewMode = "grid" | "list";

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
    <div>
      <PageHeader breadcrumb="Deliver / Catalog" title="Catalog" />

      <FilterBar
        searchParam="q"
        searchPlaceholder="Search catalog…"
        searchAriaLabel="Search catalog"
        debounceMs={300}
        resetParams={["page"]}
        tags={{
          param: "source",
          items: [
            { value: "all", label: "All sources" },
            ...SOURCES.map((src) => ({ value: src, label: sourceLabel(src) })),
          ],
        }}
        selects={[
          {
            param: "category",
            label: "Filter by category",
            allLabel: "All categories",
            options: categories.map((c) => ({ value: c, label: c })),
          },
          {
            param: "cluster",
            label: "Filter by cluster compatibility",
            allLabel: "Any cluster",
            options: (clusters.data ?? []).map((c) => ({
              value: c.id,
              label: `Runs on: ${c.name}`,
            })),
          },
          {
            param: "sort",
            label: "Sort catalog",
            allLabel: "Name A–Z",
            options: [
              { value: "name-desc", label: "Name Z–A" },
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ],
          },
        ]}
      >
        <div className="btn-group filter-bar-view" role="group" aria-label="View mode">
          <button
            type="button"
            className={`btn btn-icon ${state.view === "grid" ? "btn-secondary" : "btn-ghost"}`}
            aria-label="Grid view"
            aria-pressed={state.view === "grid"}
            onClick={() => update({ view: "grid" })}
          >
            <LayoutGrid size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`btn btn-icon ${state.view === "list" ? "btn-secondary" : "btn-ghost"}`}
            aria-label="List view"
            aria-pressed={state.view === "list"}
            onClick={() => update({ view: "list" })}
          >
            <List size={16} aria-hidden="true" />
          </button>
        </div>
      </FilterBar>

      {result.error && <Alert variant="danger">Failed to load catalog: {result.error.message}</Alert>}

      {!result.error && result.loading && !result.data && (
        <div className="catalog-grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={120} />
          ))}
        </div>
      )}

      {result.data && items.length === 0 && (
        <div className="empty">
          <span className="empty-title">No items match</span>
          <span className="empty-text">
            No catalog items match the current filters.
            {state.category && state.cluster &&
              " Discovered capabilities have no category; clear the category filter to see what this cluster already provides."}
          </span>
        </div>
      )}

      {items.length > 0 && state.view === "grid" && (
        <div className="catalog-grid">
          {items.map((item) => (
            <CatalogCard key={item.id} item={item} tenant={tenant} />
          ))}
        </div>
      )}

      {items.length > 0 && state.view === "list" && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Source</th>
              <th>Category</th>
              <th>Latest version</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link to={tenantLink(tenant, `catalog/${item.id}`)} className="table-link">
                    {item.displayName}
                  </Link>
                  <div className="mono-caption">{item.description}</div>
                </td>
                <td>
                  <span className="tag">{sourceLabel(item.source)}</span>{" "}
                  {item.scope && <TemplateScopeBadge scope={item.scope} />}
                </td>
                <td className="mono">{item.category || "—"}</td>
                <td className="mono">{item.latestVersion ? `v${item.latestVersion}` : "—"}</td>
                <td className="mono">{item.createdAt ? formatRelative(item.createdAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {total > PAGE_SIZE && (
        <div className="pagination-row">
          <span className="mono-caption">
            Page {currentPage + 1} of {pageCount} ({total} items)
          </span>
          <div className="pagination">
            <button
              type="button"
              className="page-btn"
              disabled={currentPage === 0}
              onClick={() => update({ page: currentPage - 1 })}
            >
              Previous
            </button>
            <button
              type="button"
              className="page-btn"
              disabled={currentPage >= pageCount - 1}
              onClick={() => update({ page: currentPage + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogCard({ item, tenant }: { item: CatalogItemSummary; tenant: string }) {
  return (
    <Card className="catalog-card">
      <div className="card-header catalog-card-header">
        <Link to={tenantLink(tenant, `catalog/${item.id}`)} className="table-link catalog-card-title">
          {item.displayName}
        </Link>
        <span className="tag">{sourceLabel(item.source)}</span>
      </div>
      <div className="card-body catalog-card-body">
        <p className="catalog-card-desc">{item.description}</p>
        <div className="catalog-card-meta">
          {item.scope && <TemplateScopeBadge scope={item.scope} />}
          {item.category && <span className="tag">{item.category}</span>}
          {item.latestVersion ? (
            <>
              <span className="code-inline">v{item.latestVersion}</span>
              {item.latestChannel && <span className="tag">{item.latestChannel}</span>}
            </>
          ) : (
            <span aria-label="no version published">—</span>
          )}
          <CatalogCardSlots item={item} />
        </div>
      </div>
    </Card>
  );
}
