import * as React from "react";

import { ApiError } from "@/api/client";
import {
  clearClusterFeatureFlag,
  listClusterFeatureFlags,
  setClusterFeatureFlag,
} from "@/api/feature-flags";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";

const KUBECTL_ACCESS_FLAG_KEY = "kubectl_access.enabled";

// Per-cluster kubectl access override (kill-switch v2, ADR-0016): reversible,
// cluster-scoped counterpart to the platform default managed under
// /platform/feature-flags. Disabling denies new kubectl sessions for this
// cluster only (410 for users, tunnel session closed); re-enabling restores
// access without an agent restart.
export function KubectlAccessCard({ clusterId }: { clusterId: string }) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const {
    data: flags,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listClusterFeatureFlags(t, clusterId, tenant), [clusterId, tenant]);

  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const flag = flags?.find((f) => f.key === KUBECTL_ACCESS_FLAG_KEY) ?? null;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setActionError(null);
    setBusy(true);
    try {
      await action();
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Card>
        <div className="card-body">
          Failed to load kubectl access state: {error.message}
        </div>
      </Card>
    );
  }
  if (loading && !flags) {
    return (
      <Card>
        <div className="card-body">
          Loading kubectl access state…
        </div>
      </Card>
    );
  }
  if (!flag) return null;

  return (
    <Card>
      <div className="card-header">
        <div className="flex items-center justify-between gap-2">
          <h2 className="mono-label">kubectl access</h2>
          <div className="flex items-center gap-2">
            {flag.overridden && <Badge variant="neutral">cluster override</Badge>}
            <Badge variant={flag.value ? "success" : "danger"}>
              {flag.value ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
        <p className="card-lede">
          Reversible kill switch for this cluster only. When disabled, users get a clear error
          and the tunnel session is closed; re-enabling restores access without an agent
          restart.
        </p>
      </div>
      <div className="card-body">
        {flag.envPinned && (
          <p className="text-sm u-muted">
            Pinned by an explicitly set environment variable on the platform — changes here are
            stored but have no effect until the env override is removed.
          </p>
        )}
        {actionError && <p className="text-sm u-danger">{actionError}</p>}
        <div className="flex justify-end gap-2">
          {flag.overridden && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => clearClusterFeatureFlag(token, clusterId, flag.key, tenant),
                  "Failed to remove cluster override",
                )
              }
            >
              Use platform default
            </Button>
          )}
          <Button
            variant={flag.value ? "danger" : "primary"}
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () => setClusterFeatureFlag(token, clusterId, flag.key, !flag.value, tenant),
                "Failed to update kubectl access",
              )
            }
          >
            {busy ? "Saving…" : flag.value ? "Disable for this cluster" : "Enable for this cluster"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
