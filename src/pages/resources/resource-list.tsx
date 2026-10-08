import * as React from "react";
import { useConfirm } from "@/components/confirm";
import { Link } from "react-router-dom";

import { useAsyncResource } from "@/api/hooks";
import { deleteResource, listResources } from "@/api/resources";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import type { ResourceHealth } from "@/api/types";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS, tenantLink } from "@/tenant/tenant-link";

export function HealthBadge({ health }: { health: ResourceHealth }) {
  const variant =
    health === "healthy"
      ? "success"
      : health === "progressing"
        ? "warning"
        : health === "degraded"
          ? "danger"
          : "neutral";
  return <Badge variant={variant}>{health}</Badge>;
}

const HEALTH_FILTERS: Array<{ value: ResourceHealth | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "healthy", label: "Healthy" },
  { value: "progressing", label: "Progressing" },
  { value: "degraded", label: "Degraded" },
];

export function ResourceListPage() {
  const [confirm, confirmDialog] = useConfirm();
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [healthFilter, setHealthFilter] = React.useState<ResourceHealth | "all">("all");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const {
    data: resources,
    loading,
    error,
    refetch,
  } = useAsyncResource((token) => listResources(token, tenant), [tenant], {
    refetchIntervalMs: 15_000,
  });

  const undeploy = async (id: string, name: string) => {
    if (
      !(await confirm({
        title: "Undeploy resource",
        body: `Undeploy "${name}"? This removes the instance and its desired state.`,
        confirmLabel: "Undeploy",
      }))
    ) {
      return;
    }
    setActionError(null);
    try {
      await deleteResource(token, id, tenant);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete resource");
    }
  };

  const visible = (resources ?? []).filter(
    (r) => healthFilter === "all" || r.health === healthFilter,
  );
  const showTenant = tenant === ALL_TENANTS;

  return (
    <div className="space-y-4">
      {confirmDialog}
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
          <div className="card-body">
            Failed to load resources: {error.message}
          </div>
        </Card>
      )}

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!error && loading && !resources && (
        <p className="text-sm text-muted-foreground">Loading resources…</p>
      )}

      {!error && resources && visible.length === 0 && (
        <Card>
          <div className="card-body">
            <p className="text-sm text-muted-foreground">
              {resources.length === 0
                ? "No resources yet. Deploy something from the catalog to see it here."
                : "No resources match this filter."}
            </p>
            {resources.length === 0 && (
              <Link to={tenantLink(tenant, "catalog")} className="btn btn-secondary">Browse catalog</Link>
            )}
          </div>
        </Card>
      )}

      {visible.length > 0 && (
        <Card>
          <div className="card-body">
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
                  <th className="px-4 py-2 font-medium" />
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
                    <td className="px-4 py-2">{r.clusterId}</td>
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
                    <td className="px-4 py-2 text-right">
                      <Button variant="secondary" size="sm" onClick={() => undeploy(r.id, r.name)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
