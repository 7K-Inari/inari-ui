import { Link } from "react-router-dom";
import * as React from "react";

import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import type { ClusterStatus } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS, tenantLink } from "@/tenant/tenant-link";
import { ClusterStatusBadge } from "@/pages/clusters/status-badge";

const STATUS_FILTERS: Array<{ value: ClusterStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "connected", label: "Connected" },
  { value: "pending", label: "Pending" },
  { value: "degraded", label: "Degraded" },
  { value: "disconnected", label: "Disconnected" },
];

export function ClusterListPage() {
  const { tenant } = useTenant();
  const [statusFilter, setStatusFilter] = React.useState<ClusterStatus | "all">("all");
  const { data: clusters, loading, error } = useAsyncResource(
    (token) => listClusters(token, tenant),
    [tenant],
    { refetchIntervalMs: 15_000 },
  );

  const visible = (clusters ?? []).filter(
    (c) => statusFilter === "all" || c.status === statusFilter,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clusters</h1>
          <p className="text-sm text-muted-foreground">
            Kubernetes clusters registered with the platform.
          </p>
        </div>
        <Button asChild>
          <Link to={tenantLink(tenant, "clusters/new")}>Register cluster</Link>
        </Button>
      </div>

      <div className="flex gap-1" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load clusters: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !clusters && (
        <p className="text-sm text-muted-foreground">Loading clusters…</p>
      )}

      {!error && clusters && visible.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {clusters.length === 0
                ? "No clusters registered yet. Connect your first cluster to unlock the live capability catalog."
                : "No clusters match this filter."}
            </p>
            {clusters.length === 0 && (
              <Button asChild>
                <Link to={tenantLink(tenant, "clusters/new")}>Register your first cluster</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {visible.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {tenant === ALL_TENANTS && <th className="px-4 py-2 font-medium">Tenant</th>}
                <th className="px-4 py-2 font-medium">Kubernetes</th>
                <th className="px-4 py-2 font-medium">Labels</th>
                <th className="px-4 py-2 font-medium">Capabilities</th>
                <th className="px-4 py-2 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((cluster) => (
                <tr key={cluster.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link
                      to={tenantLink(tenant, `clusters/${cluster.id}`)}
                      className="font-medium text-primary hover:underline"
                    >
                      {cluster.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <ClusterStatusBadge status={cluster.status} />
                  </td>
                  {tenant === ALL_TENANTS && (
                    <td className="px-4 py-2 font-mono text-xs">{cluster.tenant}</td>
                  )}
                  <td className="px-4 py-2 font-mono text-xs">
                    {cluster.k8sVersion ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(cluster.labels).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="font-mono">
                          {k}={v}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">{cluster.capabilityCount}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatRelative(cluster.lastSeenAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
