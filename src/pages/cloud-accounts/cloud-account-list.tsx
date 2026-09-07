import { Link } from "react-router-dom";

import { listCloudAccounts } from "@/api/cloud-accounts";
import { useAsyncResource } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { CloudAccountStatusBadge } from "@/pages/cloud-accounts/status-badge";

export function CloudAccountListPage() {
  const { tenant } = useTenant();
  const {
    data: accounts,
    loading,
    error,
  } = useAsyncResource((token) => listCloudAccounts(token, tenant), [tenant], {
    refetchIntervalMs: 15_000,
  });

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
                <th className="px-4 py-2 font-medium">Account ID</th>
                <th className="px-4 py-2 font-medium">Role ARN</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last validated</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link
                      to={tenantLink(tenant, `cloud-accounts/${account.id}`)}
                      className="font-medium font-mono text-xs text-primary hover:underline"
                    >
                      {account.accountId}
                    </Link>
                  </td>
                  <td className="px-4 py-2 break-all font-mono text-xs">{account.roleArn}</td>
                  <td className="px-4 py-2">
                    <CloudAccountStatusBadge status={account.status} />
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
    </div>
  );
}
