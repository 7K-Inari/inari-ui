import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  approveCluster,
  cordonCluster,
  decommissionCluster,
  deleteCluster,
  getCapabilities,
  getCluster,
  revokeCluster,
  uncordonCluster,
} from "@/api/clusters";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import type { CapabilityKind, ClusterDetail, ManagementMode } from "@/api/types";
import { Alert, Badge, Button, Card, Checkbox, Modal, Skeleton } from "7k-design-system/react";

import { PageHeader } from "@/components/page-header";
import { config } from "@/config";
import { SlotBoundary } from "@/ext/slot-boundary";
import { toSdkCluster } from "@/ext/mappers";
import { useClusterTabSlots } from "@/ext/slots";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { ConnectTab } from "@/pages/clusters/connect-tab";
import { KubectlAccessCard } from "@/pages/clusters/kubectl-access-card";
import { ClusterStatusBadge } from "@/pages/clusters/status-badge";

const KIND_LABELS: Record<CapabilityKind, string> = {
  crd: "Custom Resource Definitions",
  "olm-csv": "Operators (OLM)",
  xrd: "Crossplane XRDs",
  "crossplane-provider": "Crossplane Providers",
  "helm-release": "Helm Releases",
  "kro-rgd": "KRO ResourceGraphDefinitions",
};

const KIND_ORDER: CapabilityKind[] = [
  "olm-csv",
  "crossplane-provider",
  "xrd",
  "kro-rgd",
  "helm-release",
  "crd",
];

const MODE_VARIANT: Record<ManagementMode, "success" | "info" | "neutral"> = {
  adopt: "success",
  observe: "info",
  ignore: "neutral",
};

export function CapabilitiesTab({ clusterId }: { clusterId: string }) {
  const [query, setQuery] = React.useState("");
  const { data: capabilities, loading, error } = useAsyncResource(
    (token) => getCapabilities(token, clusterId),
    [clusterId],
    { refetchIntervalMs: 15_000 },
  );

  if (error) {
    return <Alert variant="danger">Failed to load capabilities: {error.message}</Alert>;
  }
  if (loading && !capabilities) {
    return (
      <div className="overview-card-skeleton" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={32} />
        ))}
      </div>
    );
  }

  const caps = (capabilities ?? []).filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.group.toLowerCase().includes(query.toLowerCase()),
  );

  if ((capabilities ?? []).length === 0) {
    return (
      <div className="empty">
        <span className="empty-title">No capabilities discovered</span>
        <span className="empty-text">
          No capabilities discovered yet. They appear automatically once the agent finishes its
          first scan — nothing to declare by hand.
        </span>
      </div>
    );
  }

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: caps.filter((c) => c.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="stack">
      <input
        className="input filter-bar-search"
        placeholder="Filter capabilities…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Filter capabilities"
      />
      {grouped.length === 0 && (
        <div className="empty">No capabilities match the filter.</div>
      )}
      {grouped.map((group) => (
        <Card key={group.kind}>
          <div className="card-header">
            <h2 className="mono-label">
              {KIND_LABELS[group.kind]} ({group.items.length})
            </h2>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Group</th>
                  <th>Version</th>
                  <th>Management</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((cap) => (
                  <tr key={cap.id}>
                    <td className="mono">{cap.name}</td>
                    <td className="mono">{cap.group}</td>
                    <td className="mono">{cap.version}</td>
                    <td>
                      <Badge variant={MODE_VARIANT[cap.managementMode]}>
                        {cap.managementMode}
                      </Badge>
                    </td>
                    <td className="mono">{formatRelative(cap.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function OverviewTab({ clusterId }: { clusterId: string }) {
  const { data: cluster } = useAsyncResource((token) => getCluster(token, clusterId), [clusterId]);
  if (!cluster) return null;
  return (
    <Card>
      <div className="card-body cluster-overview-grid">
        <div>
          <p className="mono-caption">Kubernetes version</p>
          <p className="mono-data">{cluster.k8sVersion ?? "unknown"}</p>
        </div>
        <div>
          <p className="mono-caption">Tenant</p>
          <p className="mono-data">{cluster.tenant}</p>
        </div>
        <div>
          <p className="mono-caption">Registered</p>
          <p className="mono-data">{formatRelative(cluster.createdAt)}</p>
        </div>
        <div>
          <p className="mono-caption">Last seen</p>
          <p className="mono-data">{formatRelative(cluster.lastSeenAt)}</p>
        </div>
        <div>
          <p className="mono-caption">Discovered capabilities</p>
          <p className="mono-data">{cluster.capabilityCount}</p>
        </div>
      </div>
    </Card>
  );
}

const BUILTIN_TABS = [
  { id: "capabilities", label: "Capabilities" },
  { id: "overview", label: "Overview" },
] as const;

// kubectl access (kubeconfig download + connect instructions) is gated by a
// runtime feature flag until the flag system (task f368d08b) lands.
const CONNECT_TAB = { id: "connect", label: "Connect" } as const;

function DecommissionCard({
  cluster,
  onDecommissioned,
}: {
  cluster: ClusterDetail;
  onDecommissioned: () => void;
}) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [force, setForce] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [drained, setDrained] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await decommissionCluster(token, cluster.id, { force }, tenant);
      setDrained(res.drainedInstanceIds);
      onDecommissioned();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setBlocked(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to decommission cluster");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (drained === null && cluster.status === "decommissioned") return null;

  if (drained !== null) {
    return (
      <Alert variant="success">
        Cluster decommissioned.
        {drained.length > 0
          ? ` Drained ${drained.length} instance${drained.length === 1 ? "" : "s"}: ${drained.join(", ")}.`
          : " No instances had to be drained."}
      </Alert>
    );
  }

  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">Decommission</h2>
      </div>
      <div className="card-body">
        <p className="card-lede">
          Drains all Inari-managed instances off the cluster, disables its identity, and marks it
          decommissioned. This is irreversible — the cluster must be re-registered to be used
          again.
        </p>
        <form onSubmit={submit} className="stack">
          {error && <Alert variant="danger">{error}</Alert>}
          {blocked && (
            <Checkbox
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              label="Force decommission (drain even though shared resources exist)"
            />
          )}
          <div className="wizard-actions">
            <Button type="submit" variant="danger" disabled={submitting}>
              {submitting ? "Decommissioning…" : "Decommission cluster"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

function RevokeCard({ cluster, onRevoked }: { cluster: ClusterDetail; onRevoked: () => void }) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await revokeCluster(token, cluster.id, tenant);
      onRevoked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke cluster");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">Revoke</h2>
      </div>
      <div className="card-body">
        <p className="card-lede">
          Disables the cluster&apos;s credentials. The agent disconnects immediately and cannot
          reconnect; the cluster can later be decommissioned.
        </p>
        <form onSubmit={submit} className="stack">
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="wizard-actions">
            <Button type="submit" variant="danger" disabled={submitting}>
              {submitting ? "Revoking…" : "Revoke cluster"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

export function ClusterDetailPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { clusterId } = useParams<{ clusterId: string }>();
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const extensionTabs = useClusterTabSlots();
  const builtinTabs = config.features.kubectlAccess
    ? [CONNECT_TAB, ...BUILTIN_TABS]
    : BUILTIN_TABS;
  const allTabs = [
    ...builtinTabs.map((t) => ({ id: t.id, label: t.label })),
    ...extensionTabs.map((t) => ({ id: t.id, label: t.title })),
  ];
  const requestedTab = searchParams.get("tab") ?? "capabilities";
  const tab = allTabs.some((t) => t.id === requestedTab) ? requestedTab : "capabilities";

  const {
    data: cluster,
    loading,
    error,
    refetch,
  } = useAsyncResource((token) => getCluster(token, clusterId!), [clusterId], {
    enabled: !!clusterId,
    refetchIntervalMs: 15_000,
  });

  if (error) {
    return (
      <div className="stack">
        <Alert variant="danger">Failed to load cluster: {error.message}</Alert>
        <Link to={tenantLink(tenant, "clusters")} className="btn btn-secondary">
          Back to clusters
        </Link>
      </div>
    );
  }

  if (loading && !cluster) {
    return (
      <div className="overview-card-skeleton" aria-busy="true">
        <Skeleton height={32} width="40%" />
        <Skeleton height={240} />
      </div>
    );
  }

  if (!cluster) return null;

  const lifecycleAction = async (action: () => Promise<unknown>, fallback: string) => {
    setActionError(null);
    try {
      await action();
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : fallback);
    }
  };

  const cancelRegistration = async () => {
    setConfirmCancel(false);
    setActionError(null);
    try {
      await deleteCluster(token, cluster.id, tenant);
      navigate(tenantLink(tenant, "clusters"));
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to cancel registration",
      );
    }
  };

  return (
    <div className="stack">
      <PageHeader
        breadcrumb="Operate / Clusters"
        title={cluster.name}
        actions={
          <>
            <ClusterStatusBadge status={cluster.status} />
            {Object.entries(cluster.labels).map(([k, v]) => (
              <span key={k} className="tag">
                {k}={v}
              </span>
            ))}
            {cluster.status === "pending" && (
              <>
                <Link
                  to={tenantLink(tenant, `clusters/new?cluster=${cluster.id}`)}
                  className="btn btn-secondary btn-sm"
                >
                  Resume registration
                </Link>
                <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
                  Cancel registration
                </Button>
              </>
            )}
            {cluster.status === "pending_approval" && (
              <Button
                variant="accent"
                size="sm"
                onClick={() =>
                  lifecycleAction(
                    () => approveCluster(token, cluster.id, tenant),
                    "Failed to approve cluster",
                  )
                }
              >
                Approve cluster
              </Button>
            )}
            {(cluster.status === "connected" || cluster.status === "degraded") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  lifecycleAction(
                    () => cordonCluster(token, cluster.id, tenant),
                    "Failed to cordon cluster",
                  )
                }
              >
                Cordon
              </Button>
            )}
            {cluster.status === "cordoned" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  lifecycleAction(
                    () => uncordonCluster(token, cluster.id, tenant),
                    "Failed to uncordon cluster",
                  )
                }
              >
                Uncordon
              </Button>
            )}
          </>
        }
      />

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        aria-label="Cancel registration"
      >
        <div className="decision-modal">
          <h2 className="mono-label">Cancel registration</h2>
          <p>
            Cancel the pending registration for &quot;{cluster.name}&quot;? This deletes the
            cluster record.
          </p>
          <div className="wizard-actions">
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep registration
            </Button>
            <Button variant="danger" onClick={() => void cancelRegistration()}>
              Cancel registration
            </Button>
          </div>
        </div>
      </Modal>

      <div className="tabs cluster-tabs" role="tablist" aria-label="Cluster sections">
        {allTabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab tab-accent${tab === t.id ? " active" : ""}`}
            onClick={() => setSearchParams({ tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "connect" && config.features.kubectlAccess && <ConnectTab cluster={cluster} />}
      {tab === "capabilities" && <CapabilitiesTab clusterId={cluster.id} />}
      {tab === "overview" && <OverviewTab clusterId={cluster.id} />}
      {extensionTabs
        .filter((t) => t.id === tab)
        .map((t) => (
          <SlotBoundary key={t.id} extensionName={t.extensionName}>
            <t.component cluster={toSdkCluster(cluster)} />
          </SlotBoundary>
        ))}

      {cluster.status !== "pending" && (
        <div className="stack">
          {config.features.kubectlAccess &&
            cluster.status !== "revoked" &&
            cluster.status !== "decommissioned" && <KubectlAccessCard clusterId={cluster.id} />}
          {cluster.status !== "revoked" && cluster.status !== "decommissioned" && (
            <RevokeCard cluster={cluster} onRevoked={refetch} />
          )}
          <DecommissionCard cluster={cluster} onDecommissioned={refetch} />
        </div>
      )}
    </div>
  );
}
