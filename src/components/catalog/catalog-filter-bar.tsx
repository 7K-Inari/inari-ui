import { LayoutGrid, List, Search, X } from "lucide-react";
import * as React from "react";

import type { CatalogSort, CatalogSource, ClusterSummary } from "@/api/types";

export type CatalogViewMode = "grid" | "list";

export interface CatalogFilterBarProps {
  q: string;
  source: CatalogSource | "all";
  category: string;
  cluster: string;
  sort: CatalogSort;
  view: CatalogViewMode;
  // Facet options: categories observed in the catalog, clusters for the
  // compatibility filter.
  categories: string[];
  clusters: ClusterSummary[];
  onChange: (patch: Partial<{
    q: string;
    source: CatalogSource | "all";
    category: string;
    cluster: string;
    sort: CatalogSort;
    view: CatalogViewMode;
  }>) => void;
  onClear: () => void;
}

const SOURCE_FILTERS: Array<{ value: CatalogSource | "all"; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "curated", label: "Curated" },
  { value: "discovered", label: "Discovered" },
  { value: "platform", label: "Platform" },
  { value: "template", label: "Template" },
];

const SORT_OPTIONS: Array<{ value: CatalogSort; label: string }> = [
  { value: "name", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const SEARCH_DEBOUNCE_MS = 300;

export function CatalogFilterBar({
  q,
  source,
  category,
  cluster,
  sort,
  view,
  categories,
  clusters,
  onChange,
  onClear,
}: CatalogFilterBarProps) {
  // Debounce free-text search so typing doesn't fire a request per keystroke.
  const [draft, setDraft] = React.useState(q);
  React.useEffect(() => setDraft(q), [q]);
  React.useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => onChange({ q: draft }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, q, onChange]);

  const hasActive =
    q !== "" || source !== "all" || category !== "" || cluster !== "" || sort !== "name";

  return (
    <div className="filter-bar">
      <div className="input-group filter-bar-search">
        <span className="input-addon">
          <Search size={16} aria-hidden="true" />
        </span>
        <input
          className="input"
          aria-label="Search catalog"
          placeholder="Search catalog…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>

      <div className="tag-group" role="group" aria-label="Filter by source">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={source === f.value ? "tag tag-outlined" : "tag"}
            aria-pressed={source === f.value}
            onClick={() => onChange({ source: f.value })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <select
        aria-label="Filter by category"
        className="select-native"
        value={category}
        onChange={(e) => onChange({ category: e.target.value })}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by cluster compatibility"
        className="select-native"
        value={cluster}
        onChange={(e) => onChange({ cluster: e.target.value })}
      >
        <option value="">Any cluster</option>
        {clusters.map((c) => (
          <option key={c.id} value={c.id}>
            Runs on: {c.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Sort catalog"
        className="select-native"
        value={sort}
        onChange={(e) => onChange({ sort: e.target.value as CatalogSort })}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {hasActive && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
          <X size={14} aria-hidden="true" />
          Clear filters
        </button>
      )}

      <div className="btn-group filter-bar-view" role="group" aria-label="View mode">
        <button
          type="button"
          className={`btn btn-icon ${view === "grid" ? "btn-secondary" : "btn-ghost"}`}
          aria-label="Grid view"
          aria-pressed={view === "grid"}
          onClick={() => onChange({ view: "grid" })}
        >
          <LayoutGrid size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`btn btn-icon ${view === "list" ? "btn-secondary" : "btn-ghost"}`}
          aria-label="List view"
          aria-pressed={view === "list"}
          onClick={() => onChange({ view: "list" })}
        >
          <List size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
