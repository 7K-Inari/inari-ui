import { listResources } from "@/api/resources";

// Recent-activity feed for the overview (parent design §4).
//
// TODO(server): the audit route `GET /tenants/{org}/audit` is not served by
// inari-server yet (internal/audit is store + outbox only, no HTTP handler)
// and is absent from the pinned OpenAPI snapshot. Until it lands in the
// contract, the feed falls back to recent instances by `updatedAt`. When the
// route ships, swap the fetcher below for `listAuditEvents` and map
// AuditEvent -> ActivityItem here; cards consume only ActivityItem, so the
// swap is contained to this file.

export interface ActivityItem {
  id: string;
  org: string;
  title: string;
  detail: string;
  at: string;
}

export const PER_TENANT_ACTIVITY_LIMIT = 10;
export const PER_ORG_ACTIVITY_LIMIT = 5;
export const ALL_TENANTS_ACTIVITY_LIMIT = 10;

export function sortActivity(items: ActivityItem[]): ActivityItem[] {
  return [...items].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

export async function fetchRecentActivity(
  token: string | undefined,
  tenant: string,
  limit: number = PER_TENANT_ACTIVITY_LIMIT,
): Promise<ActivityItem[]> {
  const instances = await listResources(token, tenant);
  const items: ActivityItem[] = instances.map((i) => ({
    id: i.id,
    org: i.tenant,
    title: i.name,
    detail: `${i.catalogItemName} v${i.version} · ${i.health}`,
    at: i.updatedAt,
  }));
  return sortActivity(items).slice(0, limit);
}

// All-tenants merge: take the newest `perOrgLimit` per org, then the newest
// `limit` overall (parent design §4: 5 per org merged to 10).
export function mergeOrgActivity(
  perOrg: ActivityItem[][],
  perOrgLimit: number = PER_ORG_ACTIVITY_LIMIT,
  limit: number = ALL_TENANTS_ACTIVITY_LIMIT,
): ActivityItem[] {
  const trimmed = perOrg.map((items) => sortActivity(items).slice(0, perOrgLimit));
  return sortActivity(trimmed.flat()).slice(0, limit);
}
