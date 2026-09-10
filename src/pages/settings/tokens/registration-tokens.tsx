import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { listClusters } from "@/api/clusters";
import {
  issueRegistrationToken,
  listRegistrationTokens,
  revokeRegistrationToken,
} from "@/api/secrets";
import type { IssuedToken, RegistrationToken } from "@/api/secrets";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/time";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function tokenState(t: RegistrationToken): "used" | "expired" | "active" {
  if (t.usedAt) return "used";
  if (new Date(t.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

function IssuedTokenDialog({
  issued,
  onClose,
}: {
  issued: IssuedToken;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card role="dialog" aria-label="Registration token issued">
      <CardHeader>
        <CardTitle className="text-base">Registration token issued</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This token is shown once and cannot be retrieved later. Store it
          securely; it expires {formatRelative(issued.expiresAt)}.
        </p>
        <code className="block break-all rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
          {issued.token}
        </code>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? "Copied" : "Copy token"}
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TokenRow({
  tenant,
  clusterId,
  record,
  canWrite,
  onChanged,
}: {
  tenant: string;
  clusterId: string;
  record: RegistrationToken;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const state = tokenState(record);

  const revoke = async () => {
    setActionError(null);
    setBusy(true);
    try {
      await revokeRegistrationToken(token, tenant, clusterId, record.id);
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to revoke token",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-2 font-mono text-xs">{record.id}</td>
      <td className="px-4 py-2 text-muted-foreground">{record.createdBy}</td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {formatRelative(record.createdAt)}
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {formatRelative(record.expiresAt)}
      </td>
      <td className="px-4 py-2">
        {state === "active" && <Badge variant="success">active</Badge>}
        {state === "used" && <Badge variant="muted">used</Badge>}
        {state === "expired" && <Badge variant="warning">expired</Badge>}
      </td>
      <td className="px-4 py-2 text-right">
        {actionError && (
          <span className="mr-2 text-xs text-destructive">{actionError}</span>
        )}
        {canWrite && state === "active" && (
          <Button variant="outline" size="sm" disabled={busy} onClick={revoke}>
            Revoke
          </Button>
        )}
      </td>
    </tr>
  );
}

export function RegistrationTokensPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();

  const { data: clusters, error: clustersError } = useAsyncResource(
    (t) => listClusters(t, tenant),
    [tenant],
  );
  const [clusterId, setClusterId] = React.useState("");
  const selectedCluster = clusterId || clusters?.[0]?.id || "";

  const {
    data: tokens,
    loading,
    error,
    refetch,
  } = useAsyncResource(
    (t) => listRegistrationTokens(t, tenant, selectedCluster),
    [tenant, selectedCluster],
    { enabled: selectedCluster !== "" },
  );

  const [issuing, setIssuing] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<IssuedToken | null>(null);

  const issue = async () => {
    setActionError(null);
    setIssuing(true);
    try {
      const result = await issueRegistrationToken(token, tenant, selectedCluster);
      setIssued(result);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to issue token",
      );
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Registration tokens"
        description="One-time bootstrap tokens for connecting clusters to this organization."
        actions={
          !canWriteSettings ? (
            <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
          ) : undefined
        }
      />

      {clustersError && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load clusters: {clustersError.message}
          </CardContent>
        </Card>
      )}

      {!clustersError && clusters && clusters.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No clusters registered — register a cluster before issuing tokens.
          </CardContent>
        </Card>
      )}

      {clusters && clusters.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex max-w-xl items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="token-cluster">Cluster</Label>
                <select
                  id="token-cluster"
                  className={selectClass}
                  value={selectedCluster}
                  onChange={(e) => setClusterId(e.target.value)}
                >
                  {clusters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {canWriteSettings && (
                <Button onClick={issue} disabled={issuing || !selectedCluster}>
                  {issuing ? "Issuing…" : "Issue token"}
                </Button>
              )}
            </div>
            {actionError && (
              <p className="mt-3 text-sm text-destructive">{actionError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {issued && (
        <IssuedTokenDialog issued={issued} onClose={() => setIssued(null)} />
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load tokens: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && selectedCluster && loading && !tokens && (
        <p className="text-sm text-muted-foreground">Loading tokens…</p>
      )}

      {tokens && tokens.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No registration tokens issued for this cluster.
          </CardContent>
        </Card>
      )}

      {tokens && tokens.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Token ID</th>
                <th className="px-4 py-2 font-medium">Issued by</th>
                <th className="px-4 py-2 font-medium">Issued</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <TokenRow
                  key={t.id}
                  tenant={tenant}
                  clusterId={selectedCluster}
                  record={t}
                  canWrite={canWriteSettings}
                  onChanged={refetch}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
