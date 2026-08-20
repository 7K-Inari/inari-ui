import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { getClusterSet } from "@/api/fleet";
import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

export function ClusterSetDetailPage() {
  const { tenant } = useTenant();
  const { clusterSetId } = useParams<{ clusterSetId: string }>();

  const set = useAsyncResource(
    (token) => getClusterSet(token, tenant, clusterSetId!),
    [clusterSetId, tenant],
  );
  const clusters = useAsyncResource((token) => listClusters(token, tenant), [tenant]);

  if (set.error) {
    const notFound = set.error instanceof ApiError && set.error.status === 404;
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {notFound ? "ClusterSet not found." : `Failed to load ClusterSet: ${set.error.message}`}
        </p>
        <Button asChild variant="outline">
          <Link to={tenantLink(tenant, "fleet")}>Back to fleet</Link>
        </Button>
      </div>
    );
  }

  if (set.loading && !set.data) {
    return <p className="text-sm text-muted-foreground">Loading ClusterSet…</p>;
  }
  if (!set.data) return null;
  const data = set.data;

  const members = (clusters.data ?? []).filter((c) => data.memberClusterIds.includes(c.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
        <p className="text-sm text-muted-foreground">ClusterSet · label-targeted fleet group</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Targeting labels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1 pt-0">
          {Object.entries(data.labels).map(([k, v]) => (
            <Badge key={k} variant="outline" className="font-mono">
              {k}={v}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Member clusters ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
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
                {members.map((cluster) => (
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
                      <Badge variant={cluster.status === "connected" ? "success" : "muted"}>
                        {cluster.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
