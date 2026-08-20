import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import type { ValidationResult } from "@/api/cloud-accounts";
import { getCloudAccount, getTrustSnippet, validateCloudAccount } from "@/api/cloud-accounts";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import {
  TrustSnippetTabs,
  ValidationResultView,
} from "@/pages/cloud-accounts/connect-wizard";
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
  const trust = useAsyncResource(
    (t) => getTrustSnippet(t, accountId!, tenant),
    [accountId, tenant],
    { enabled: !!accountId },
  );

  const [validation, setValidation] = React.useState<ValidationResult | null>(null);
  const [validating, setValidating] = React.useState(false);

  const runValidation = async () => {
    if (!accountId) return;
    setValidating(true);
    setValidation(null);
    try {
      const result = await validateCloudAccount(token, accountId, tenant);
      setValidation(result);
      refetch();
    } catch (err) {
      setValidation({
        status: "failed",
        message: err instanceof Error ? err.message : "Validation request failed",
        providerConfigName: null,
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setValidating(false);
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
            / {account.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          <p className="text-sm text-muted-foreground">
            AWS account <code className="font-mono text-xs">{account.accountId}</code> connected via
            a trust role.
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
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Regions</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                {account.regions.map((region) => (
                  <Badge key={region} variant="outline" className="font-mono">
                    {region}
                  </Badge>
                ))}
              </dd>
            </div>
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
            <ValidationResultView result={validation} accountId={account.id} tenant={tenant} />
          )}
        </CardContent>
      </Card>

      {account.providerConfigName && (
        <Card>
          <CardHeader>
            <CardTitle>ProviderConfig</CardTitle>
            <CardDescription>
              Crossplane ProviderConfig created for this account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="font-mono text-xs" data-testid="provider-config-name">
              {account.providerConfigName}
            </code>
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
        <CardContent>
          {trust.error && (
            <p className="text-sm text-destructive">
              Failed to load trust snippet: {trust.error.message}
            </p>
          )}
          {!trust.error && trust.loading && !trust.data && (
            <p className="text-sm text-muted-foreground">Loading trust snippet…</p>
          )}
          {trust.data && <TrustSnippetTabs trust={trust.data} />}
        </CardContent>
      </Card>
    </div>
  );
}
