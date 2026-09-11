import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantLink } from "@/tenant/tenant-link";
import {
  fetchRecentActivity,
  mergeOrgActivity,
  PER_ORG_ACTIVITY_LIMIT,
  type ActivityItem,
} from "@/pages/overview/activity-feed";
import { ActivityListItems } from "@/pages/overview/activity-card";
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

// Recent activity merged across the caller's orgs (5 per org, newest 10
// overall). Orgs the caller cannot read (403) are dropped silently; other
// failures degrade to an inline chip without blanking the section.
export function AllTenantsActivitySection({ orgs, orgNames }: SectionProps) {
  const { entries, overflow, refetchAll } = useOrgFanout(
    orgs,
    (token, org) => fetchRecentActivity(token, org, PER_ORG_ACTIVITY_LIMIT),
    { refetchIntervalMs: ALL_TENANTS_POLL_MS },
  );

  const firstLoad =
    entries.length > 0 && entries.every((e) => e.state.data === null && e.state.loading);
  const loaded = entries.filter((e) => e.state.data !== null);
  const items: ActivityItem[] = mergeOrgActivity(
    loaded.map((e) => e.state.data ?? []),
  );
  const errors = entries.filter(
    (e) => e.state.error && !e.state.data && !isForbidden(e.state.error),
  );
  // Orgs the caller cannot read are dropped; when every org is forbidden the
  // whole card hides, mirroring the per-tenant OverviewCard 403 behavior.
  const allForbidden =
    entries.length > 0 &&
    entries.every((e) => e.state.error && !e.state.data && isForbidden(e.state.error));
  const settled = entries.filter(
    (e) => e.state.data !== null || (e.state.error && isForbidden(e.state.error)),
  );

  if (allForbidden) {
    return null;
  }

  return (
    <Card data-testid="all-activity">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent activity</CardTitle>
        {orgs[0] && (
          <Link
            to={tenantLink(orgs[0], "deploys")}
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {firstLoad && <SectionSkeleton />}
        {!firstLoad && items.length > 0 && (
          <ActivityListItems items={items} orgNames={orgNames} />
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
        {!firstLoad && settled.length === entries.length && items.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">
            No recent activity across your organizations.
          </p>
        )}
        <OverflowNote count={overflow} />
      </CardContent>
    </Card>
  );
}
