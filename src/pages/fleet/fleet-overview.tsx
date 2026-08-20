import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  listAgentChannels,
  listClusterSets,
  listDrift,
  listRollouts,
  setAgentChannel,
  type AgentChannel,
} from "@/api/fleet";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const TABS = [
  { id: "clustersets", label: "ClusterSets" },
  { id: "rollouts", label: "Rollouts" },
  { id: "drift", label: "Drift" },
  { id: "channels", label: "Agent channels" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ROLLOUT_STATE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  running: "warning",
  "waiting-approval": "warning",
  completed: "success",
  failed: "destructive",
  "rolled-back": "muted",
};

function ClusterSetsTab() {
  const { tenant } = useTenant();
  const sets = useAsyncResource((token) => listClusterSets(token, tenant), [tenant]);

  if (sets.loading && !sets.data) {
    return <p className="text-sm text-muted-foreground">Loading cluster sets…</p>;
  }
  if ((sets.data ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No ClusterSets defined yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(sets.data ?? []).map((set) => (
        <Card key={set.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <Link
                to={tenantLink(tenant, `fleet/clustersets/${set.id}`)}
                className="hover:underline"
              >
                {set.name}
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            <div className="flex flex-wrap gap-1">
              {Object.entries(set.labels).map(([k, v]) => (
                <Badge key={k} variant="outline" className="font-mono">
                  {k}={v}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground">
              {set.memberClusterIds.length} member cluster
              {set.memberClusterIds.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RolloutsTab() {
  const { tenant } = useTenant();
  const rollouts = useAsyncResource((token) => listRollouts(token, tenant), [tenant], {
    refetchIntervalMs: 5_000,
  });

  if (rollouts.loading && !rollouts.data) {
    return <p className="text-sm text-muted-foreground">Loading rollouts…</p>;
  }
  if ((rollouts.data ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No rollouts in flight.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Rollout</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">ClusterSet</th>
              <th className="px-4 py-2 font-medium">State</th>
              <th className="px-4 py-2 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {(rollouts.data ?? []).map((rollout) => (
              <tr key={rollout.id} className="border-t">
                <td className="px-4 py-2">
                  <Link
                    to={tenantLink(tenant, `fleet/rollouts/${rollout.id}`)}
                    className="hover:underline"
                  >
                    {rollout.name}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {rollout.target.name}@{rollout.target.version}
                </td>
                <td className="px-4 py-2">{rollout.clusterSetName}</td>
                <td className="px-4 py-2">
                  <Badge variant={ROLLOUT_STATE_VARIANT[rollout.state] ?? "muted"}>
                    {rollout.state}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {formatRelative(rollout.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function DriftTab() {
  const { tenant } = useTenant();
  const drift = useAsyncResource((token) => listDrift(token, tenant), [tenant], {
    refetchIntervalMs: 15_000,
  });

  if (drift.loading && !drift.data) {
    return <p className="text-sm text-muted-foreground">Checking for drift…</p>;
  }
  if ((drift.data ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No drift detected — desired and reported state match everywhere.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drift is report-only in v1 — reconcile via the owning GitOps repo.
      </p>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Cluster</th>
                <th className="px-4 py-2 font-medium">Resource</th>
                <th className="px-4 py-2 font-medium">Field</th>
                <th className="px-4 py-2 font-medium">Desired</th>
                <th className="px-4 py-2 font-medium">Reported</th>
                <th className="px-4 py-2 font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {(drift.data ?? []).map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="px-4 py-2">{entry.clusterName}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {entry.resourceKind}/{entry.name}
                    <span className="text-muted-foreground"> · {entry.namespace}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{entry.field}</td>
                  <td className="px-4 py-2 font-mono text-xs">{entry.desired}</td>
                  <td className="px-4 py-2 font-mono text-xs text-amber-700 dark:text-amber-400">
                    {entry.reported}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatRelative(entry.detectedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentChannelsTab() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const channels = useAsyncResource((token) => listAgentChannels(token, tenant), [tenant]);
  const [error, setError] = React.useState<string | null>(null);

  if (channels.loading && !channels.data) {
    return <p className="text-sm text-muted-foreground">Loading agent channels…</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">ClusterSet</th>
              <th className="px-4 py-2 font-medium">Channel</th>
              <th className="px-4 py-2 font-medium">Agent version</th>
              <th className="px-4 py-2 font-medium">Min supported (N−1)</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(channels.data ?? []).map((assignment) => (
              <tr key={assignment.clusterSetId} className="border-t">
                <td className="px-4 py-2">{assignment.clusterSetName}</td>
                <td className="px-4 py-2">
                  <Badge variant={assignment.channel === "canary" ? "warning" : "secondary"}>
                    {assignment.channel}
                  </Badge>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {assignment.currentVersion}
                  {assignment.currentVersion !== assignment.latestVersion && (
                    <span className="text-muted-foreground">
                      {" "}
                      → {assignment.latestVersion} available
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {assignment.minSupportedVersion}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setError(null);
                      const next: AgentChannel =
                        assignment.channel === "stable" ? "canary" : "stable";
                      try {
                        await setAgentChannel(token, tenant, assignment.clusterSetId, next);
                        channels.refetch();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Failed to update channel",
                        );
                      }
                    }}
                  >
                    Switch to {assignment.channel === "stable" ? "canary" : "stable"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && (
          <p className="px-4 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function FleetOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") ?? "clustersets";
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "clustersets";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
        <p className="text-sm text-muted-foreground">
          ClusterSets, staged rollouts, drift, and agent upgrade channels.
        </p>
      </div>

      <div className="flex gap-1 border-b" role="tablist" aria-label="Fleet sections">
        {TABS.map((t) => (
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

      {tab === "clustersets" && <ClusterSetsTab />}
      {tab === "rollouts" && <RolloutsTab />}
      {tab === "drift" && <DriftTab />}
      {tab === "channels" && <AgentChannelsTab />}
    </div>
  );
}
