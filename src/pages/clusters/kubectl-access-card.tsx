import * as React from "react";

import { ApiError } from "@/api/client";
import {
  clearClusterFeatureFlag,
  listClusterFeatureFlags,
  setClusterFeatureFlag,
} from "@/api/feature-flags";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <CardContent className="py-6 text-sm text-destructive">
          Failed to load kubectl access state: {error.message}
        </CardContent>
      </Card>
    );
  }
  if (loading && !flags) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Loading kubectl access state…
        </CardContent>
      </Card>
    );
  }
  if (!flag) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">kubectl access</CardTitle>
          <div className="flex items-center gap-2">
            {flag.overridden && <Badge variant="outline">cluster override</Badge>}
            <Badge variant={flag.value ? "success" : "destructive"}>
              {flag.value ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Reversible kill switch for this cluster only. When disabled, users get a clear error
          and the tunnel session is closed; re-enabling restores access without an agent
          restart.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {flag.envPinned && (
          <p className="text-sm text-muted-foreground">
            Pinned by an explicitly set environment variable on the platform — changes here are
            stored but have no effect until the env override is removed.
          </p>
        )}
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        <div className="flex justify-end gap-2">
          {flag.overridden && (
            <Button
              variant="outline"
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
            variant={flag.value ? "destructive" : "default"}
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
      </CardContent>
    </Card>
  );
}
