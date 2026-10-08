import { Link, useSearchParams } from "react-router-dom";
import * as React from "react";
import { Alert, Button, Modal, Skeleton } from "7k-design-system/react";

import { deleteCluster, listClusters } from "@/api/clusters";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import type { ClusterStatus, ClusterSummary } from "@/api/types";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS, tenantLink } from "@/tenant/tenant-link";
import { ClusterStatusBadge } from "@/pages/clusters/status-badge";

const STATUS_OPTIONS: Array<{ value: ClusterStatus; label: string }> = [
  { value: "connected", label: "Connected" },
  { value: "pending", label: "Pending" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "degraded", label: "Degraded" },
  { value: "cordoned", label: "Cordoned" },
  { value: "revoked", label: "Revoked" },
  { value: "decommissioned", label: "Decommissioned" },
  { value: "disconnected", label: "Disconnected" },
];

const QUICK_FILTERS: Array<{ value: ClusterStatus; label: string }> = [
  { value: "degraded", label: "Degraded" },
  { value: "pending", label: "Pending" },
  { value: "disconnected", label: "Disconnected" },
];

export function ClusterListPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "all";
  const [confirmCancel, setConfirmCancel] = React.useState<ClusterSummary | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const {
    data: clusters,
    loading,
    error,
    refetch,
  } = useAsyncResource((token) => listClusters(token, tenant), [tenant], {
    refetchIntervalMs: 15_000,
  });

  const cancelRegistration = async (cluster: ClusterSummary) => {
    setConfirmCancel(null);
    setActionError(null);
    try {
      await deleteCluster(token, cluster.id, tenant);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to cancel registration",
      );
    }
  };

  const all = clusters ?? [];
  const visible = all.filter((c) => statusFilter === "all" || c.status === statusFilter);
  const degraded = all.filter((c) => c.status === "degraded").length;

  return (
    <div>
      <PageHeader
        breadcrumb="Operate / Clusters"
        title="Clusters"
        actions={
          <Link to={tenantLink(tenant, "clusters/new")} className="btn btn-glow-accent">
            Register cluster
          </Link>
        }
      />

      {degraded > 0 && (
        <div className="banner banner-warning" data-testid="degraded-banner">
          <span className="banner-count">{degraded}</span>
          <span>
            degraded cluster{degraded === 1 ? "" : "s"} need{degraded === 1 ? "s" : ""} attention
          </span>
          <Link to="?status=degraded" className="banner-link">
            View degraded
          </Link>
        </div>
      )}

      <FilterBar
        tags={{
          param: "status",
          items: QUICK_FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count: all.filter((c) => c.status === f.value).length,
          })),
        }}
        selects={[
          {
            param: "status",
            label: "Filter by status",
            allLabel: "All statuses",
            options: STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />

      {error && (
        <Alert variant="danger">
          <span>Failed to load clusters: {error.message}</span>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </Alert>
      )}

      {!error && loading && !clusters && (
        <div className="overview-card-skeleton" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={32} />
          ))}
        </div>
      )}

      {!error && clusters && visible.length === 0 && (
        <div className="empty">
          <span className="empty-title">
            {all.length === 0 ? "No clusters registered" : "No clusters match"}
          </span>
          <span className="empty-text">
            {all.length === 0
              ? "No clusters registered yet. Connect your first cluster to unlock the live capability catalog."
              : "No clusters match this filter."}
          </span>
          {all.length === 0 && (
            <Link to={tenantLink(tenant, "clusters/new")} className="btn btn-accent">
              Register your first cluster
            </Link>
          )}
        </div>
      )}

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {visible.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              {tenant === ALL_TENANTS && <th>Tenant</th>}
              <th>Kubernetes</th>
              <th>Labels</th>
              <th>Capabilities</th>
              <th>Last seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((cluster) => (
              <tr key={cluster.id}>
                <td>
                  <Link
                    to={tenantLink(tenant, `clusters/${cluster.id}`)}
                    className="table-link"
                  >
                    {cluster.name}
                  </Link>
                </td>
                <td>
                  <ClusterStatusBadge status={cluster.status} />
                </td>
                {tenant === ALL_TENANTS && <td className="mono">{cluster.tenant}</td>}
                <td className="mono">{cluster.k8sVersion ?? "—"}</td>
                <td>
                  <span className="cluster-labels">
                    {Object.entries(cluster.labels).map(([k, v]) => (
                      <span key={k} className="tag">
                        {k}={v}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="mono">{cluster.capabilityCount}</td>
                <td className="mono">{formatRelative(cluster.lastSeenAt)}</td>
                <td>
                  {cluster.status === "pending" && (
                    <span className="cluster-row-actions">
                      <Link
                        to={tenantLink(tenant, `clusters/new?cluster=${cluster.id}`)}
                        className="btn btn-secondary btn-sm"
                      >
                        Resume registration
                      </Link>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmCancel(cluster)}
                      >
                        Cancel registration
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        aria-label="Cancel registration"
      >
        {confirmCancel && (
          <div className="decision-modal">
            <h2 className="mono-label">Cancel registration</h2>
            <p>
              Cancel the pending registration for &quot;{confirmCancel.name}&quot;? This deletes
              the cluster record.
            </p>
            <div className="wizard-actions">
              <Button variant="ghost" onClick={() => setConfirmCancel(null)}>
                Keep registration
              </Button>
              <Button variant="danger" onClick={() => void cancelRegistration(confirmCancel)}>
                Cancel registration
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
