import * as React from "react";
import { Link } from "react-router-dom";

import { listCatalogItems } from "@/api/catalog";
import { useAsyncResource } from "@/api/hooks";
import type { CatalogSource } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  const items = useAsyncResource(
    (token) =>
      listCatalogItems(token, tenant, {
        source: source === "all" ? undefined : source,
      }),
    [tenant, source],
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
              <Badge variant="muted">{item.source}</Badge>
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
        ))}
      </div>
    </div>
  );
}
