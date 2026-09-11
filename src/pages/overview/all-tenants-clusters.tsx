import { Link } from "react-router-dom";

import { listClusters } from "@/api/clusters";
import type { ClusterSummary } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantLink } from "@/tenant/tenant-link";
import {
  ALL_TENANTS_POLL_MS,
  OrgErrorChip,
  OverflowNote,
  SectionSkeleton,
} from "@/pages/overview/all-tenants-approvals";
import { isForbidden } from "@/pages/overview/overview-card";
import { useOrgFanout } from "@/pages/overview/use-org-fanout";

interface SectionProps {
  orgs: string[];
  orgNames: Map<string, string>;
}

function OrgClusterChip({
  org,
  name,
  clusters,
}: {
  org: string;
  name: string;
  clusters: ClusterSummary[];
}) {
  const connected = clusters.filter((c) => c.status === "connected").length;
  const unhealthy = clusters.filter(
    (c) => c.status === "degraded" || c.status === "disconnected",
  ).length;
  return (
    <div data-testid={`org-chip-${org}`}>
      <Link
        to={tenantLink(org, "clusters")}
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:border-primary/50"
      >
        <span className="min-w-0 truncate font-medium">{name}</span>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {connected}/{clusters.length}
        </span>
        {unhealthy > 0 && (
          <span className="text-xs text-destructive">{unhealthy} unhealthy</span>
        )}
      </Link>
    </div>
  );
}

// Cluster health rollup: one chip per org with connected/total counts. Slower
// 60s polling than the per-tenant page (fan-out cost, plan Risk #6).
export function AllTenantsClusterRollup({ orgs, orgNames }: SectionProps) {
  const { entries, overflow, refetchAll } = useOrgFanout(orgs, listClusters, {
    refetchIntervalMs: ALL_TENANTS_POLL_MS,
  });

  const firstLoad =
    entries.length > 0 && entries.every((e) => e.state.data === null && e.state.loading);
  const chips = entries.filter((e) => (e.state.data?.length ?? 0) > 0);
  const errors = entries.filter(
    (e) => e.state.error && !e.state.data && !isForbidden(e.state.error),
  );
  const allEmpty =
    entries.length > 0 &&
    entries.every((e) => e.state.data !== null && e.state.data.length === 0);

  return (
    <Card data-testid="all-clusters">
      <CardHeader>
        <CardTitle className="text-base">Cluster health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {firstLoad && <SectionSkeleton />}
        {chips.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {chips.map(({ org, state }) => (
              <OrgClusterChip
                key={org}
                org={org}
                name={orgNames.get(org) ?? org}
                clusters={state.data ?? []}
              />
            ))}
          </div>
        )}
        {errors.map(({ org, state }) => (
          <OrgErrorChip
            key={org}
            org={org}
            name={orgNames.get(org) ?? org}
            message={state.error?.message ?? "Request failed"}
            onRetry={refetchAll}
          />
        ))}
        {allEmpty && (
          <p className="py-2 text-sm text-muted-foreground">
            No clusters registered across your organizations.
          </p>
        )}
        <OverflowNote count={overflow} />
      </CardContent>
    </Card>
  );
}
