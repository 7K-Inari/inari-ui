import * as React from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  decideRolloutGate,
  getRollout,
  rollbackRollout,
  type RolloutStage,
} from "@/api/fleet";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const CLUSTER_STATE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  healthy: "success",
  deploying: "warning",
  failed: "destructive",
  pending: "muted",
};

const GATE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  approved: "success",
  open: "warning",
  rejected: "destructive",
  closed: "muted",
};

function StageCard({
  rolloutId,
  stage,
  onDecided,
}: {
  rolloutId: string;
  stage: RolloutStage;
  onDecided: () => void;
}) {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    setBusy(true);
    setError(null);
    try {
      await decideRolloutGate(token, tenant, rolloutId, stage.name, decision);
      onDecided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gate decision failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {stage.name} <span className="text-xs text-muted-foreground">({stage.kind})</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={GATE_VARIANT[stage.gate.state]}>
              {stage.gate.type === "approval" ? `approval gate: ${stage.gate.state}` : `auto gate: ${stage.gate.state}`}
            </Badge>
            {stage.gate.type === "approval" && stage.gate.state === "open" && (
              <>
                <Button size="sm" disabled={busy} onClick={() => decide("approve")}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => decide("reject")}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <p className="pb-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-4 font-medium">Cluster</th>
              <th className="py-1 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {stage.clusters.map((cluster) => (
              <tr key={cluster.clusterId} className="border-t">
                <td className="py-1.5 pr-4">{cluster.clusterName}</td>
                <td className="py-1.5">
                  <Badge variant={CLUSTER_STATE_VARIANT[cluster.state] ?? "muted"}>
                    {cluster.state}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function RolloutDetailPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { rolloutId } = useParams<{ rolloutId: string }>();
  const [actionError, setActionError] = React.useState<string | null>(null);

  const rollout = useAsyncResource(
    (t) => getRollout(t, tenant, rolloutId!),
    [rolloutId, tenant],
    { refetchIntervalMs: 1_000, enabled: Boolean(rolloutId) },
  );

  if (rollout.error) {
    const notFound = rollout.error instanceof ApiError && rollout.error.status === 404;
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {notFound ? "Rollout not found." : `Failed to load rollout: ${rollout.error.message}`}
        </p>
        <Button asChild variant="outline">
          <Link to={tenantLink(tenant, "fleet")}>Back to fleet</Link>
        </Button>
      </div>
    );
  }

  if (rollout.loading && !rollout.data) {
    return <p className="text-sm text-muted-foreground">Loading rollout…</p>;
  }
  if (!rollout.data) return null;
  const data = rollout.data;

  const total = data.stages.flatMap((s) => s.clusters).length;
  const healthy = data.stages.flatMap((s) => s.clusters).filter((c) => c.state === "healthy").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.target.kind} <span className="font-mono text-xs">{data.target.name}@{data.target.version}</span>{" "}
            · ClusterSet {data.clusterSetName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.state === "completed" ? "success" : data.state === "failed" ? "destructive" : "warning"}>
            {data.state}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {healthy}/{total} clusters healthy
          </span>
          {(data.state === "running" || data.state === "waiting-approval" || data.state === "failed") && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setActionError(null);
                try {
                  await rollbackRollout(token, tenant, data.id);
                  rollout.refetch();
                } catch (err) {
                  setActionError(
                    err instanceof ApiError ? err.message : "Rollback failed",
                  );
                }
              }}
            >
              Roll back
            </Button>
          )}
        </div>
      </div>
      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      <div className="space-y-3">
        {data.stages.map((stage) => (
          <StageCard
            key={stage.name}
            rolloutId={data.id}
            stage={stage}
            onDecided={rollout.refetch}
          />
        ))}
      </div>
    </div>
  );
}
