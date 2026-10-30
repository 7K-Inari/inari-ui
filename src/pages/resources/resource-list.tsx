import * as React from "react";
import { useConfirm } from "@/components/confirm";
import { Link } from "react-router-dom";

import { useAsyncResource } from "@/api/hooks";
import { deleteResource, listResources } from "@/api/resources";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import type { ResourceHealth, ResourceInstanceSummary } from "@/api/types";
import { Badge, Button, Card, DataTable, type DataTableColumn } from "7k-design-system/react";
import { PlatformResourcesSection } from "@/pages/resources/platform-resources-section";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS, tenantLink } from "@/tenant/tenant-link";
import { LoadingState } from "@/components/loading";

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

  const columns: DataTableColumn<ResourceInstanceSummary>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <Link to={tenantLink(tenant, `deploys/${r.id}`)} className="table-link">
          {r.name}
        </Link>
      ),
    },
    ...(showTenant ? [{ key: "tenant", label: "Tenant", mono: true } as const] : []),
    { key: "catalogItemName", label: "Catalog item" },
    { key: "clusterId", label: "Cluster", mono: true },
    {
      key: "health",
      label: "Health",
      render: (r) => <HealthBadge health={r.health} />,
    },
    { key: "status", label: "Status", mono: true },
    { key: "ownerTeam", label: "Owner team", mono: true },
    {
      key: "version",
      label: "Version",
      render: (r) => (
        <span className="mono-data">
          {r.version}
          {r.updateAvailable && (
            <Badge variant="warning" className="ml-2">
              {r.updateAvailable.to} available
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Button variant="secondary" size="sm" onClick={() => undeploy(r.id, r.name)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div>
        <h1 className="page-header-title">Resources</h1>
        <p className="text-sm u-muted">
          Platform resources synced from the tenant GitOps state repos, and all deployed instances
          across clusters and cloud accounts in this scope.
        </p>
      </div>

      <PlatformResourcesSection />

      <section className="space-y-3" aria-label="Deployed instances">
        <h2 className="mono-label">Deployed instances</h2>
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

        {actionError && <p className="text-sm u-danger">{actionError}</p>}

        {!error && loading && !resources && (
          <LoadingState label="Loading resources…" />
        )}

        {!error && resources && visible.length === 0 && (
          <Card>
            <div className="card-body">
              <p className="text-sm u-muted">
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
          <DataTable<ResourceInstanceSummary>
            columns={columns}
            rows={visible}
            rowKey="id"
          />
        )}
      </section>
    </div>
  );
}
