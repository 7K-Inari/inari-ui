import * as React from "react";

import { ApiError } from "@/api/client";
import {
  clearPlatformFeatureFlag,
  listPlatformFeatureFlags,
  setPlatformFeatureFlag,
} from "@/api/feature-flags";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";

// Platform feature flags (/platform/feature-flags): runtime kill-switches and
// toggles from the feature-flags API (kill-switch v2, ADR-0016). Platform
// admins set the platform-wide default; per-cluster overrides live on the
// cluster detail page. An explicitly set env override pins a flag — writes
// are accepted by the API but stay inert until the env is unset.
export function PlatformFeatureFlagsPage() {
  const { token } = useAuth();
  const {
    data: flags,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listPlatformFeatureFlags(t), []);

  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>, fallback: string) => {
    setActionError(null);
    setBusyKey(key);
    try {
      await action();
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform feature flags</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide runtime defaults. Tenant admins can override cluster-scoped flags per
          cluster from the cluster detail page.
        </p>
      </div>

      {error && (
        <Card>
          <div className="card-body">
            Failed to load feature flags: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !flags && (
        <p className="text-sm text-muted-foreground">Loading feature flags…</p>
      )}

      {!error && flags && flags.length === 0 && (
        <Card>
          <div className="card-body">
            No runtime feature flags registered.
          </div>
        </Card>
      )}

      {actionError && (
        <Card>
          <div className="card-body">{actionError}</div>
        </Card>
      )}

      {flags?.map((flag) => (
        <Card key={flag.key}>
          <div className="card-header">
            <div className="flex items-center justify-between gap-2">
              <h2 className="mono-label">{flag.key}</h2>
              <div className="flex items-center gap-2">
                {flag.overridden && <Badge variant="neutral">override</Badge>}
                <Badge variant={flag.value ? "success" : "danger"}>
                  {flag.value ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
            <p className="card-lede">{flag.description}</p>
          </div>
          <div className="card-body">
            {flag.envPinned && (
              <p className="text-sm text-muted-foreground">
                Pinned by an explicitly set environment variable — changes here are stored but
                have no effect until the env override is removed.
              </p>
            )}
            <div className="flex justify-end gap-2">
              {flag.overridden && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyKey === flag.key}
                  onClick={() =>
                    run(
                      flag.key,
                      () => clearPlatformFeatureFlag(token, flag.key),
                      "Failed to reset flag",
                    )
                  }
                >
                  Reset to default ({flag.default ? "enabled" : "disabled"})
                </Button>
              )}
              <Button
                variant={flag.value ? "danger" : "primary"}
                size="sm"
                disabled={busyKey === flag.key}
                onClick={() =>
                  run(
                    flag.key,
                    () => setPlatformFeatureFlag(token, flag.key, !flag.value),
                    "Failed to update flag",
                  )
                }
              >
                {busyKey === flag.key
                  ? "Saving…"
                  : flag.value
                    ? "Disable platform-wide"
                    : "Enable platform-wide"}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
