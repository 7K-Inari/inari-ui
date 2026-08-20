import * as React from "react";
import { Link } from "react-router-dom";

import { listCatalogItems } from "@/api/catalog";
import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import type { CatalogSource } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CatalogCardSlots } from "@/ext/slots";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const SOURCE_FILTERS: Array<{ value: CatalogSource | "all"; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "curated", label: "Curated" },
  { value: "discovered", label: "Discovered" },
  { value: "platform", label: "Platform" },
];

const SOURCE_BADGE: Record<CatalogSource, { label: string; variant: "default" | "secondary" | "warning" }> = {
  curated: { label: "Curated", variant: "default" },
  discovered: { label: "Discovered", variant: "secondary" },
  platform: { label: "Platform", variant: "warning" },
};

export function CatalogBrowsePage() {
  const { tenant } = useTenant();
  const [source, setSource] = React.useState<CatalogSource | "all">("all");
  const [category, setCategory] = React.useState("");
  const [clusterId, setClusterId] = React.useState("");

  const items = useAsyncResource(
    (token) =>
      listCatalogItems(token, tenant, {
        source: source === "all" ? undefined : source,
        category: category || undefined,
        clusterId: clusterId || undefined,
      }),
    [tenant, source, category, clusterId],
  );
  const clusters = useAsyncResource((token) => listClusters(token, tenant), [tenant]);
  const allItems = useAsyncResource((token) => listCatalogItems(token, tenant), [tenant]);

  const categories = React.useMemo(
    () => Array.from(new Set((allItems.data ?? []).map((i) => i.category))).sort(),
    [allItems.data],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Curated packages, discovered capabilities, and platform apps available to this scope.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-1" role="group" aria-label="Filter by source">
          {SOURCE_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={source === f.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSource(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-category">Category</Label>
          <select
            id="catalog-category"
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-cluster">Cluster compatibility</Label>
          <select
            id="catalog-cluster"
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={clusterId}
            onChange={(e) => setClusterId(e.target.value)}
          >
            <option value="">Any cluster</option>
            {(clusters.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {items.error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load catalog: {items.error.message}
          </CardContent>
        </Card>
      )}

      {!items.error && items.loading && !items.data && (
        <p className="text-sm text-muted-foreground">Loading catalog…</p>
      )}

      {items.data && items.data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No catalog items match the current filters.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(items.data ?? []).map((item) => (
          <Card key={item.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <Link
                    to={tenantLink(tenant, `catalog/${item.id}`)}
                    className="hover:underline"
                  >
                    {item.displayName}
                  </Link>
                </CardTitle>
                <Badge variant={SOURCE_BADGE[item.source].variant}>
                  {SOURCE_BADGE[item.source].label}
                </Badge>
              </div>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex flex-wrap items-center gap-2 pt-0 text-xs text-muted-foreground">
              <Badge variant="muted">{item.category}</Badge>
              <span>v{item.latestVersion}</span>
              <CatalogCardSlots item={item} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
