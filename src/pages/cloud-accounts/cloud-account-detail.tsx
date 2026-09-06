import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import type { CloudAccount } from "@/api/cloud-accounts";
import {
  getCloudAccount,
  renderCloudAccountProviderConfig,
  validateCloudAccount,
} from "@/api/cloud-accounts";
import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import {
  TrustRoleFacts,
  ValidationStateView,
} from "@/pages/cloud-accounts/connect-wizard";
import { CopyButton } from "@/pages/cloud-accounts/copy-button";
import { CloudAccountStatusBadge } from "@/pages/cloud-accounts/status-badge";

export function CloudAccountDetailPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { accountId } = useParams<{ accountId: string }>();

  const {
    data: account,
    loading,
    error,
    refetch,
  } = useAsyncResource(
    (t) => getCloudAccount(t, accountId!, tenant),
    [accountId, tenant],
    { enabled: !!accountId },
  );
  const { data: clusters } = useAsyncResource(
    (t) => listClusters(t, tenant),
    [tenant],
  );

  const [clusterId, setClusterId] = React.useState("");
  const effectiveClusterId = clusterId || clusters?.[0]?.id || "";
  const providerConfig = useAsyncResource(
    (t) => renderCloudAccountProviderConfig(t, accountId!, effectiveClusterId, tenant),
    [accountId, tenant, effectiveClusterId],
    { enabled: !!accountId && !!effectiveClusterId && account?.status === "connected" },
  );

  const [validation, setValidation] = React.useState<CloudAccount | null>(null);
  const [validating, setValidating] = React.useState(false);

  const runValidation = async () => {
    if (!accountId || !account) return;
    setValidating(true);
    setValidation(null);
    try {
      const result = await validateCloudAccount(token, accountId, tenant);
      setValidation(result);
    } catch (err) {
      setValidation({
        ...account,
        status: "failed",
        statusMessage: err instanceof Error ? err.message : "Validation request failed",
      });
    } finally {
      setValidating(false);
      refetch();
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Failed to load cloud account: {error.message}
        </CardContent>
      </Card>
    );
  }
  if (loading && !account) {
    return <p className="text-sm text-muted-foreground">Loading cloud account…</p>;
  }
  if (!account) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link to={tenantLink(tenant, "cloud-accounts")} className="hover:underline">
              Cloud Accounts
            </Link>{" "}
            / <span className="font-mono">{account.accountId}</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight font-mono">
            {account.accountId}
          </h1>
          <p className="text-sm text-muted-foreground">
            AWS account connected via a trust role — no credentials are stored on the platform.
          </p>
        </div>
        <CloudAccountStatusBadge status={account.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {account.status === "connected"
              ? "The trust role validated successfully and the account is ready."
              : account.status === "failed"
                ? "The last validation attempt failed."
                : account.status === "validating"
                  ? "Validation is in progress."
                  : "Waiting for the trust role to be created in the tenant account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Account ID</dt>
              <dd className="font-mono text-xs">{account.accountId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Role ARN</dt>
              <dd className="break-all text-right font-mono text-xs">{account.roleArn}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">ExternalId</dt>
              <dd className="font-mono text-xs">{account.externalId}</dd>
            </div>
            {account.issuerUrl && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">OIDC issuer</dt>
                <dd className="break-all text-right font-mono text-xs">{account.issuerUrl}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Last validated</dt>
              <dd>{formatRelative(account.lastValidatedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatRelative(account.createdAt)}</dd>
            </div>
            {account.statusMessage && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status detail</dt>
                <dd className="text-right text-destructive">{account.statusMessage}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validate</CardTitle>
          <CardDescription>
            Runs a dry-run AssumeRole against the trust role to confirm the connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runValidation} disabled={validating}>
            {validating ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> Validating…
              </>
            ) : validation ? (
              "Retry validation"
            ) : (
              "Validate now"
            )}
          </Button>
          {validation && (
            <ValidationStateView account={validation} accountId={account.id} tenant={tenant} />
          )}
        </CardContent>
      </Card>

      {account.status === "connected" && (
        <Card>
          <CardHeader>
            <CardTitle>ProviderConfig</CardTitle>
            <CardDescription>
              Crossplane ProviderConfig manifest rendered by the server for a cluster.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="provider-config-cluster" className="text-sm text-muted-foreground">
                Cluster
              </label>
              <select
                id="provider-config-cluster"
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={effectiveClusterId}
                onChange={(e) => setClusterId(e.target.value)}
              >
                {(clusters ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {providerConfig.error && (
              <p className="text-sm text-destructive">
                Failed to render ProviderConfig: {providerConfig.error.message}
              </p>
            )}
            {!providerConfig.error && providerConfig.loading && !providerConfig.data && (
              <p className="text-sm text-muted-foreground">Rendering ProviderConfig…</p>
            )}
            {providerConfig.data && (
              <>
                <pre
                  className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs"
                  data-testid="provider-config-manifest"
                >
                  {providerConfig.data}
                </pre>
                <CopyButton value={providerConfig.data} label="Copy manifest" />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Trust setup</CardTitle>
          <CardDescription>
            One-time trust role setup for this account. Apply in AWS account{" "}
            <code className="font-mono text-xs">{account.accountId}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TrustRoleFacts account={account} />
          <CopyButton value={account.externalId} label="Copy ExternalId" />
        </CardContent>
      </Card>
    </div>
  );
}
