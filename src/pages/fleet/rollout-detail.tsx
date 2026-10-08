import * as React from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  getRollout,
  listRolloutTargets,
  rollbackRollout,
  type Rollout,
  type RolloutTarget,
} from "@/api/fleet";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const TARGET_STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  healthy: "success",
  deployed: "success",
  deploying: "warning",
  running: "warning",
  failed: "danger",
  pending: "neutral",
};

const GATE_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  approval: "warning",
  auto: "neutral",
};

interface RolloutWithTargets {
  rollout: Rollout;
  targets: RolloutTarget[];
}

function StageCard({
  index,
  stage,
  targets,
}: {
  index: number;
  stage: Rollout["stages"][number];
  targets: RolloutTarget[];
}) {
  const stageTargets = targets.filter((t) => t.stage === index);

  return (
    <Card>
      <div className="card-header">
        <div className="flex items-center justify-between gap-2">
          <h2 className="mono-label">
            {stage.name}{" "}
            <span className="text-xs text-muted-foreground">
              max {stage.maxConcurrency} concurrent
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {stage.gates.map((gate) => (
              <Badge variant={GATE_VARIANT[gate.type] ?? "neutral"}>
                {gate.type} gate ({gate.when}
                {gate.waitSeconds != null ? `, ${gate.waitSeconds}s` : ""})
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="card-body">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-4 font-medium">Cluster</th>
              <th className="py-1 pr-4 font-medium">Status</th>
              <th className="py-1 font-medium">Observed health</th>
            </tr>
          </thead>
          <tbody>
            {stageTargets.length === 0 ? (
              <tr>
                <td className="py-1.5 text-muted-foreground" colSpan={3}>
                  No targets assigned to this stage yet.
                </td>
              </tr>
            ) : (
              stageTargets.map((target) => (
                <tr key={target.clusterId} className="border-t">
                  <td className="py-1.5 pr-4 font-mono text-xs">{target.clusterId}</td>
                  <td className="py-1.5 pr-4">
                    <Badge variant={TARGET_STATUS_VARIANT[target.status] ?? "neutral"}>
                      {target.status}
                    </Badge>
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {target.observedHealth ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function RolloutDetailPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { rolloutId } = useParams<{ rolloutId: string }>();
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [terminal, setTerminal] = React.useState(false);
  const resource = useAsyncResource<RolloutWithTargets>(
    async (t) => {
      const [rollout, targets] = await Promise.all([
        getRollout(t, tenant, rolloutId!),
        listRolloutTargets(t, tenant, rolloutId!),
      ]);
      return { rollout, targets };
    },
    [rolloutId, tenant],
    { refetchIntervalMs: 1_000, enabled: Boolean(rolloutId) && !terminal },
  );

  // Stop live polling once the rollout reaches a terminal state.
  const state = resource.data?.rollout.state;
  React.useEffect(() => {
    if (state === "completed" || state === "failed" || state === "rolled-back") {
      setTerminal(true);
    }
  }, [state]);

  if (resource.error) {
    const notFound = resource.error instanceof ApiError && resource.error.status === 404;
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {notFound ? "Rollout not found." : `Failed to load rollout: ${resource.error.message}`}
        </p>
        <Link to={tenantLink(tenant, "fleet")} className="btn btn-secondary">Back to fleet</Link>
      </div>
    );
  }

  if (resource.loading && !resource.data) {
    return <p className="text-sm text-muted-foreground">Loading rollout…</p>;
  }
  if (!resource.data) return null;
  const data = resource.data.rollout;
  const targets = resource.data.targets;

  const healthy = targets.filter((t) => t.status === "healthy").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-header-title">{data.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.target.kind} <span className="font-mono text-xs">{data.target.name}@{data.target.version}</span>{" "}
            · stage {Math.min(data.currentStage + 1, data.stages.length)}/{data.stages.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.state === "completed" ? "success" : data.state === "failed" ? "danger" : "warning"}>
            {data.state}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {healthy}/{targets.length} clusters healthy
          </span>
          {(data.state === "running" || data.state === "waiting-approval" || data.state === "failed") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setActionError(null);
                try {
                  await rollbackRollout(token, tenant, data.id);
                  resource.refetch();
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

      {data.state === "waiting-approval" && (
        <p className="text-sm text-muted-foreground">
          This rollout is waiting on an approval gate — decide the linked approval request in
          the Approvals inbox to continue.
        </p>
      )}

      <div className="space-y-3">
        {data.stages.map((stage, index) => (
          <StageCard key={stage.name} index={index} stage={stage} targets={targets} />
        ))}
      </div>
    </div>
  );
}
