import { useAsyncResource } from "@/api/hooks";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import {
  fetchRecentActivity,
  PER_TENANT_ACTIVITY_LIMIT,
  type ActivityItem,
} from "@/pages/overview/activity-feed";
import { OverviewCard } from "@/pages/overview/overview-card";

// Shared with the all-tenants home: a compact list of recent activity rows.
export function ActivityListItems({
  items,
  orgNames,
}: {
  items: ActivityItem[];
  orgNames?: Map<string, string>;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {orgNames && (
                <span className="text-muted-foreground">
                  {orgNames.get(item.org) ?? item.org} ·{" "}
                </span>
              )}
              {item.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelative(item.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ActivityCard() {
  const { tenant } = useTenant();
  const state = useAsyncResource(
    (token) => fetchRecentActivity(token, tenant, PER_TENANT_ACTIVITY_LIMIT),
    [tenant],
    { refetchIntervalMs: 60_000 },
  );

  return (
    <OverviewCard
      title="Recent activity"
      testId="card-activity"
      href={tenantLink(tenant, "deploys")}
      state={state}
      isEmpty={(items) => items.length === 0}
      empty={<p>No recent activity. Deploys and updates will appear here.</p>}
    >
      {(items: ActivityItem[]) => <ActivityListItems items={items} />}
    </OverviewCard>
  );
}
