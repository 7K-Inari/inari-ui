import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { getClusterSet, listClusterSetMembers } from "@/api/fleet";
import { useAsyncResource } from "@/api/hooks";
import { Badge } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

export function ClusterSetDetailPage() {
  const { tenant } = useTenant();
  const { clusterSetId } = useParams<{ clusterSetId: string }>();

  const set = useAsyncResource(
    (token) => getClusterSet(token, tenant, clusterSetId!),
    [clusterSetId, tenant],
  );
  const members = useAsyncResource(
    (token) => listClusterSetMembers(token, tenant, clusterSetId!),
    [clusterSetId, tenant],
  );

  if (set.error) {
    const notFound = set.error instanceof ApiError && set.error.status === 404;
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {notFound ? "ClusterSet not found." : `Failed to load ClusterSet: ${set.error.message}`}
        </p>
        <Link to={tenantLink(tenant, "fleet")} className="btn btn-secondary">Back to fleet</Link>
      </div>
    );
  }

  if (set.loading && !set.data) {
    return <p className="text-sm text-muted-foreground">Loading ClusterSet…</p>;
  }
  if (!set.data) return null;
  const data = set.data;

  const memberList = members.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-header-title">{data.name}</h1>
        <p className="text-sm text-muted-foreground">ClusterSet · label-targeted fleet group</p>
      </div>

      <Card>
        <div className="card-header">
          <h2 className="mono-label">Targeting labels</h2>
        </div>
        <div className="card-body">
          {Object.entries(data.labels).map(([k, v]) => (
            <Badge key={k} variant="neutral" className="font-mono">
              {k}={v}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <div className="card-header">
          <h2 className="mono-label">
            Member clusters ({memberList.length})
          </h2>
        </div>
        <div className="card-body">
          {members.loading && !members.data ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Resolving member clusters…
            </p>
          ) : memberList.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No member clusters match this set's labels yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Cluster</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {memberList.map((cluster) => (
                  <tr key={cluster.id} className="border-t">
                    <td className="px-4 py-2">
                      <Link
                        to={tenantLink(tenant, `clusters/${cluster.id}`)}
                        className="hover:underline"
                      >
                        {cluster.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={cluster.state === "active" ? "success" : "neutral"}>
                        {cluster.state}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
