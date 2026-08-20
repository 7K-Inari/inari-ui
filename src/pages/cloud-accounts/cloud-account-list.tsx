import { Link } from "react-router-dom";

import { listCloudAccounts, listProviderConfigs } from "@/api/cloud-accounts";
import { useAsyncResource } from "@/api/hooks";
import type { ProviderConfig } from "@/api/cloud-accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { CloudAccountStatusBadge } from "@/pages/cloud-accounts/status-badge";

const HEALTH_VARIANT: Record<ProviderConfig["health"], "success" | "warning" | "muted"> = {
  healthy: "success",
  degraded: "warning",
  unknown: "muted",
};

export function CloudAccountListPage() {
  const { tenant } = useTenant();
  const {
    data: accounts,
    loading,
    error,
  } = useAsyncResource((token) => listCloudAccounts(token, tenant), [tenant], {
    refetchIntervalMs: 15_000,
  });
  const { data: providerConfigs } = useAsyncResource(
    (token) => listProviderConfigs(token, tenant),
    [tenant],
    { refetchIntervalMs: 15_000 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cloud Accounts</h1>
          <p className="text-sm text-muted-foreground">
            AWS accounts connected via trust roles — no tenant credentials are stored on the
            platform.
          </p>
        </div>
        <Button asChild>
          <Link to={tenantLink(tenant, "cloud-accounts/new")}>Connect AWS account</Link>
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load cloud accounts: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !accounts && (
        <p className="text-sm text-muted-foreground">Loading cloud accounts…</p>
      )}

      {!error && accounts && accounts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No cloud accounts connected yet. Connect an AWS account to provision managed
              resources.
            </p>
            <Button asChild>
              <Link to={tenantLink(tenant, "cloud-accounts/new")}>Connect your first account</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {accounts && accounts.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Account ID</th>
                <th className="px-4 py-2 font-medium">Regions</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">ProviderConfig</th>
                <th className="px-4 py-2 font-medium">Last validated</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link
                      to={tenantLink(tenant, `cloud-accounts/${account.id}`)}
                      className="font-medium text-primary hover:underline"
                    >
                      {account.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{account.accountId}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {account.regions.map((region) => (
                        <Badge key={region} variant="outline" className="font-mono">
                          {region}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <CloudAccountStatusBadge status={account.status} />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {account.providerConfigName ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatRelative(account.lastValidatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {providerConfigs && providerConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ProviderConfigs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Kind</th>
                    <th className="px-4 py-2 font-medium">Health</th>
                    <th className="px-4 py-2 font-medium">Account ID</th>
                  </tr>
                </thead>
                <tbody>
                  {providerConfigs.map((pc) => (
                    <tr key={pc.name} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{pc.name}</td>
                      <td className="px-4 py-2">{pc.kind}</td>
                      <td className="px-4 py-2">
                        <Badge variant={HEALTH_VARIANT[pc.health]}>{pc.health}</Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{pc.accountId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
