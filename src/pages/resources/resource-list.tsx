import * as React from "react";
import { Link } from "react-router-dom";

import { useAsyncResource } from "@/api/hooks";
import { listResources } from "@/api/resources";
import type { ResourceHealth } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS, tenantLink } from "@/tenant/tenant-link";

export function HealthBadge({ health }: { health: ResourceHealth }) {
  const variant =
    health === "healthy"
      ? "success"
      : health === "progressing"
        ? "warning"
        : health === "degraded"
          ? "destructive"
          : "muted";
  return <Badge variant={variant}>{health}</Badge>;
}

const HEALTH_FILTERS: Array<{ value: ResourceHealth | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "healthy", label: "Healthy" },
  { value: "progressing", label: "Progressing" },
  { value: "degraded", label: "Degraded" },
];

export function ResourceListPage() {
  const { tenant } = useTenant();
  const [healthFilter, setHealthFilter] = React.useState<ResourceHealth | "all">("all");
  const { data: resources, loading, error } = useAsyncResource(
    (token) => listResources(token, tenant),
    [tenant],
    { refetchIntervalMs: 15_000 },
  );

  const visible = (resources ?? []).filter(
    (r) => healthFilter === "all" || r.health === healthFilter,
  );
  const showTenant = tenant === ALL_TENANTS;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
        <p className="text-sm text-muted-foreground">
          All deployed instances across clusters and cloud accounts in this scope.
        </p>
      </div>

      <div className="flex gap-1" role="group" aria-label="Filter by health">
        {HEALTH_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={healthFilter === f.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setHealthFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load resources: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !resources && (
        <p className="text-sm text-muted-foreground">Loading resources…</p>
      )}

      {!error && resources && visible.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {resources.length === 0
                ? "No resources yet. Deploy something from the catalog to see it here."
                : "No resources match this filter."}
            </p>
            {resources.length === 0 && (
              <Button asChild variant="outline">
                <Link to={tenantLink(tenant, "catalog")}>Browse catalog</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {visible.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Name</th>
                  {showTenant && <th className="px-4 py-2 font-medium">Tenant</th>}
                  <th className="px-4 py-2 font-medium">Catalog item</th>
                  <th className="px-4 py-2 font-medium">Cluster</th>
                  <th className="px-4 py-2 font-medium">Health</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Owner team</th>
                  <th className="px-4 py-2 font-medium">Version</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Link
                        to={tenantLink(tenant, `deploys/${r.id}`)}
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    {showTenant && <td className="px-4 py-2">{r.tenant}</td>}
                    <td className="px-4 py-2">{r.catalogItemName}</td>
                    <td className="px-4 py-2">{r.clusterName}</td>
                    <td className="px-4 py-2">
                      <HealthBadge health={r.health} />
                    </td>
                    <td className="px-4 py-2">{r.status}</td>
                    <td className="px-4 py-2">{r.ownerTeam}</td>
                    <td className="px-4 py-2">
                      {r.version}
                      {r.updateAvailable && (
                        <Badge variant="warning" className="ml-2">
                          {r.updateAvailable.to} available
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
