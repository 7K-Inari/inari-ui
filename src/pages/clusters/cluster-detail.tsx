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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SlotBoundary } from "@/ext/slot-boundary";
import { toSdkCluster } from "@/ext/mappers";
import { useClusterTabSlots } from "@/ext/slots";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
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

const MODE_VARIANT: Record<ManagementMode, "success" | "secondary" | "muted"> = {
  adopt: "success",
  observe: "secondary",
  ignore: "muted",
};

export function CapabilitiesTab({ clusterId }: { clusterId: string }) {
  const [query, setQuery] = React.useState("");
  const { data: capabilities, loading, error } = useAsyncResource(
    (token) => getCapabilities(token, clusterId),
    [clusterId],
    { refetchIntervalMs: 15_000 },
  );

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load capabilities: {error.message}
      </p>
    );
  }
  if (loading && !capabilities) {
    return <p className="text-sm text-muted-foreground">Discovering capabilities…</p>;
  }

  const caps = (capabilities ?? []).filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.group.toLowerCase().includes(query.toLowerCase()),
  );

  if ((capabilities ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No capabilities discovered yet. They appear automatically once the agent finishes its
          first scan — nothing to declare by hand.
        </CardContent>
      </Card>
    );
  }

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: caps.filter((c) => c.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter capabilities…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Filter capabilities"
        className="max-w-sm"
      />
      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground">No capabilities match the filter.</p>
      )}
      {grouped.map((group) => (
        <Card key={group.kind}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {KIND_LABELS[group.kind]}{" "}
              <span className="text-muted-foreground">({group.items.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 font-medium">Name</th>
                  <th className="py-1 pr-4 font-medium">Group</th>
                  <th className="py-1 pr-4 font-medium">Version</th>
                  <th className="py-1 pr-4 font-medium">Management</th>
                  <th className="py-1 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((cap) => (
                  <tr key={cap.id} className="border-t">
                    <td className="py-1.5 pr-4 font-mono text-xs">{cap.name}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground">
                      {cap.group}
                    </td>
                    <td className="py-1.5 pr-4">{cap.version}</td>
                    <td className="py-1.5 pr-4">
                      <Badge variant={MODE_VARIANT[cap.managementMode]}>
                        {cap.managementMode}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {formatRelative(cap.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
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
      <CardContent className="grid grid-cols-2 gap-4 py-6 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Kubernetes version</p>
          <p className="font-mono">{cluster.k8sVersion ?? "unknown"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tenant</p>
          <p className="font-mono">{cluster.tenant}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Registered</p>
          <p>{formatRelative(cluster.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last seen</p>
          <p>{formatRelative(cluster.lastSeenAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Discovered capabilities</p>
          <p>{cluster.capabilityCount}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const BUILTIN_TABS = [
  { id: "capabilities", label: "Capabilities" },
  { id: "overview", label: "Overview" },
] as const;

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
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Cluster decommissioned.
          {drained.length > 0
            ? ` Drained ${drained.length} instance${drained.length === 1 ? "" : "s"}: ${drained.join(", ")}.`
            : " No instances had to be drained."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decommission</CardTitle>
        <CardDescription>
          Drains all Inari-managed instances off the cluster, disables its identity, and marks it
          decommissioned. This is irreversible — the cluster must be re-registered to be used
          again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {blocked && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
              Force decommission (drain even though shared resources exist)
            </label>
          )}
          <div className="flex justify-end">
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? "Decommissioning…" : "Decommission cluster"}
            </Button>
          </div>
        </form>
      </CardContent>
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
      <CardHeader>
        <CardTitle className="text-base">Revoke</CardTitle>
        <CardDescription>
          Disables the cluster&apos;s credentials. The agent disconnects immediately and cannot
          reconnect; the cluster can later be decommissioned.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? "Revoking…" : "Revoke cluster"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ClusterDetailPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { clusterId } = useParams<{ clusterId: string }>();
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const extensionTabs = useClusterTabSlots();
  const allTabs = [
    ...BUILTIN_TABS.map((t) => ({ id: t.id, label: t.label })),
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
      <div className="space-y-3">
        <p className="text-sm text-destructive">Failed to load cluster: {error.message}</p>
        <Button asChild variant="outline">
          <Link to={tenantLink(tenant, "clusters")}>Back to clusters</Link>
        </Button>
      </div>
    );
  }

  if (loading && !cluster) {
    return <p className="text-sm text-muted-foreground">Loading cluster…</p>;
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
    if (
      !window.confirm(
        `Cancel the pending registration for "${cluster.name}"? This deletes the cluster record.`,
      )
    ) {
      return;
    }
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{cluster.name}</h1>
        <ClusterStatusBadge status={cluster.status} />
        <div className="flex flex-wrap gap-1">
          {Object.entries(cluster.labels).map(([k, v]) => (
            <Badge key={k} variant="outline" className="font-mono">
              {k}={v}
            </Badge>
          ))}
        </div>
        {cluster.status === "pending" && (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={tenantLink(tenant, `clusters/new?cluster=${cluster.id}`)}>
                Resume registration
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={cancelRegistration}>
              Cancel registration
            </Button>
          </div>
        )}
        {cluster.status === "pending_approval" && (
          <Button
            variant="outline"
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
            variant="outline"
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
            variant="outline"
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
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="flex gap-1 border-b" role="tablist" aria-label="Cluster sections">
        {allTabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={
              tab === t.id
                ? "border-b-2 border-primary px-3 py-2 text-sm font-medium"
                : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
            onClick={() => setSearchParams({ tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

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
        <div className="space-y-4">
          {cluster.status !== "revoked" && cluster.status !== "decommissioned" && (
            <RevokeCard cluster={cluster} onRevoked={refetch} />
          )}
          <DecommissionCard cluster={cluster} onDecommissioned={refetch} />
        </div>
      )}
    </div>
  );
}
