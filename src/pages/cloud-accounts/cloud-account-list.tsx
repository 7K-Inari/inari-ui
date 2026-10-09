import { Link } from "react-router-dom";

import { listCloudAccounts } from "@/api/cloud-accounts";
import { useAsyncResource } from "@/api/hooks";
import { Card } from "7k-design-system/react";
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
          <h1 className="page-header-title">Cloud Accounts</h1>
          <p className="text-sm u-muted">
            AWS accounts connected via trust roles — no tenant credentials are stored on the
            platform.
          </p>
        </div>
        <Link to={tenantLink(tenant, "cloud-accounts/new")} className="btn btn-primary">Connect AWS account</Link>
      </div>

      {error && (
        <Card>
          <div className="card-body">
            Failed to load cloud accounts: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !accounts && (
        <p className="text-sm u-muted">Loading cloud accounts…</p>
      )}

      {!error && accounts && accounts.length === 0 && (
        <Card>
          <div className="card-body">
            <p className="text-sm u-muted">
              No cloud accounts connected yet. Connect an AWS account to provision managed
              resources.
            </p>
            <Link to={tenantLink(tenant, "cloud-accounts/new")} className="btn btn-primary">Connect your first account</Link>
          </div>
        </Card>
      )}

      {accounts && accounts.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="u-raised/50 text-left text-xs u-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Account ID</th>
                <th className="px-4 py-2 font-medium">Role ARN</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last validated</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t hover:u-raised/30">
                  <td className="px-4 py-2">
                    <Link
                      to={tenantLink(tenant, `cloud-accounts/${account.id}`)}
                      className="font-medium font-mono text-xs u-brand hover:underline"
                    >
                      {account.accountId}
                    </Link>
                  </td>
                  <td className="px-4 py-2 break-all font-mono text-xs">{account.roleArn}</td>
                  <td className="px-4 py-2">
                    <CloudAccountStatusBadge status={account.status} />
                  </td>
                  <td className="px-4 py-2 u-muted">
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
