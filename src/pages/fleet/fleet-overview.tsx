import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createClusterSet,
  deleteClusterSet,
  listAgentChannels,
  listClusterSets,
  listDrift,
  listRollouts,
  setAgentChannel,
  type AgentChannel,
} from "@/api/fleet";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
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

const ROLLOUT_STATE_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  running: "warning",
  "waiting-approval": "warning",
  completed: "success",
  failed: "danger",
  "rolled-back": "neutral",
};

function parseLabels(input: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const pair of input.split(",")) {
    const [k, v] = pair.split("=", 2).map((s) => s.trim());
    if (k && v) labels[k] = v;
  }
  return labels;
}

function CreateClusterSetForm({ onCreated }: { onCreated: () => void }) {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [name, setName] = React.useState("");
  const [labels, setLabels] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
          await createClusterSet(token, tenant, { name, labels: parseLabels(labels) });
          setName("");
          setLabels("");
          onCreated();
        } catch (err) {
          setError(
            err instanceof ApiError ? err.message : "Failed to create ClusterSet",
          );
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <label className="form-label" htmlFor="cs-name">Name</label>
        <Input
          id="cs-name"
          value={name}
          onChange={(v) => setName(v)}
          placeholder="prod-us"
          required
        />
      </div>
      <div className="min-w-64 space-y-1.5">
        <label className="form-label" htmlFor="cs-labels">Targeting labels</label>
        <Input
          id="cs-labels"
          value={labels}
          onChange={(v) => setLabels(v)}
          placeholder="region=us, env=prod"
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create ClusterSet"}
      </Button>
      {error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function ClusterSetsTab() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const sets = useAsyncResource((token) => listClusterSets(token, tenant), [tenant]);
  const [actionError, setActionError] = React.useState<string | null>(null);

  if (sets.loading && !sets.data) {
    return <p className="text-sm text-muted-foreground">Loading cluster sets…</p>;
  }
  return (
    <div className="space-y-4">
      {(sets.data ?? []).length === 0 ? (
        <Card>
          <div className="card-body">
            No ClusterSets defined yet.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(sets.data ?? []).map((set) => (
            <Card key={set.id}>
              <div className="card-header">
                <h2 className="mono-label">
                  <Link
                    to={tenantLink(tenant, `fleet/clustersets/${set.id}`)}
                    className="hover:underline"
                  >
                    {set.name}
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setActionError(null);
                      try {
                        await deleteClusterSet(token, tenant, set.id);
                        sets.refetch();
                      } catch (err) {
                        setActionError(
                          err instanceof ApiError
                            ? err.message
                            : "Failed to delete ClusterSet",
                        );
                      }
                    }}
                  >
                    Delete
                  </Button>
                </h2>
              </div>
              <div className="card-body">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(set.labels).map(([k, v]) => (
                    <Badge key={k} variant="neutral" className="font-mono">
                      {k}={v}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground">
                  Members resolve from the label selector server-side.
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}
      <CreateClusterSetForm onCreated={sets.refetch} />
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
        <div className="card-body">
          No rollouts in flight.
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="card-body">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Rollout</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Stages</th>
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
                <td className="px-4 py-2 text-muted-foreground">
                  {rollout.stages.map((s) => s.name).join(" → ")}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={ROLLOUT_STATE_VARIANT[rollout.state] ?? "neutral"}>
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
      </div>
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
        <div className="card-body">
          No drift detected — desired and reported state match everywhere.
        </div>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drift is report-only in v1 — reconcile via the owning GitOps repo.
      </p>
      <Card>
        <div className="card-body">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Cluster</th>
                <th className="px-4 py-2 font-medium">Resource</th>
                <th className="px-4 py-2 font-medium">Detail</th>
                <th className="px-4 py-2 font-medium">Desired hash</th>
                <th className="px-4 py-2 font-medium">Reported hash</th>
                <th className="px-4 py-2 font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {(drift.data ?? []).map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{entry.clusterId}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {entry.kind}/{entry.resourceRef ?? "unknown"}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {entry.detail ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{entry.desiredHash}</td>
                  <td className="px-4 py-2 font-mono text-xs text-amber-700 dark:text-amber-400">
                    {entry.reportedHash}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatRelative(entry.detectedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AgentChannelsTab() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const channels = useAsyncResource((token) => listAgentChannels(token, tenant), [tenant]);
  const clusterSets = useAsyncResource((token) => listClusterSets(token, tenant), [tenant]);
  const [error, setError] = React.useState<string | null>(null);

  // Channel pins carry no ClusterSet name; resolve it from the ClusterSets
  // list loaded in-page.
  const setNameById = new Map((clusterSets.data ?? []).map((s) => [s.id, s.name]));

  if ((channels.loading && !channels.data) || (clusterSets.loading && !clusterSets.data)) {
    return <p className="text-sm text-muted-foreground">Loading agent channels…</p>;
  }
  return (
    <Card>
      <div className="card-body">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">ClusterSet</th>
              <th className="px-4 py-2 font-medium">Channel</th>
              <th className="px-4 py-2 font-medium">Desired agent version</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(channels.data ?? []).map((assignment) => (
              <tr key={assignment.clusterSetId} className="border-t">
                <td className="px-4 py-2">
                  {setNameById.get(assignment.clusterSetId) ?? assignment.clusterSetId}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={assignment.channel === "canary" ? "warning" : "neutral"}>
                    {assignment.channel}
                  </Badge>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {assignment.desiredAgentVersion}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setError(null);
                      const next: AgentChannel =
                        assignment.channel === "stable" ? "canary" : "stable";
                      try {
                        await setAgentChannel(
                          token,
                          tenant,
                          assignment.clusterSetId,
                          next,
                          assignment.desiredAgentVersion,
                        );
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
      </div>
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
