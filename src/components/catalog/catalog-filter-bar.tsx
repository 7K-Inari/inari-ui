import { LayoutGrid, List, Search, X } from "lucide-react";
import * as React from "react";

import type { CatalogSort, CatalogSource, ClusterSummary } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search catalog"
          placeholder="Search catalog…"
          className="w-64 pl-8"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>

      <div className="flex gap-1" role="group" aria-label="Filter by source">
        {SOURCE_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={source === f.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onChange({ source: f.value })}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <select
        aria-label="Filter by category"
        className={selectClass}
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
        className={selectClass}
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
        className={selectClass}
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
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" />
          Clear filters
        </Button>
      )}

      <div className="ml-auto flex gap-1" role="group" aria-label="View mode">
        <Button
          variant={view === "grid" ? "secondary" : "ghost"}
          size="sm"
          aria-label="Grid view"
          onClick={() => onChange({ view: "grid" })}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={view === "list" ? "secondary" : "ghost"}
          size="sm"
          aria-label="List view"
          onClick={() => onChange({ view: "list" })}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
