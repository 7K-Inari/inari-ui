import { Link } from "react-router-dom";

import { useAsyncResource } from "@/api/hooks";
import type { ZoneStatus } from "@/api/zones";
import { listZones } from "@/api/zones";
import { Badge } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const STATUS_CONFIG: Record<
  ZoneStatus,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  requested: { label: "Requested", variant: "warning" },
  pending_approval: { label: "Pending approval", variant: "warning" },
  provisioning: { label: "Provisioning", variant: "warning" },
  wiring: { label: "Wiring", variant: "warning" },
  active: { label: "Active", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  manual_intervention: { label: "Manual intervention", variant: "danger" },
  decommission_pending_approval: {
    label: "Decommission pending approval",
    variant: "warning",
  },
  cordoning: { label: "Cordoning", variant: "warning" },
  draining: { label: "Draining", variant: "warning" },
  decommissioning: { label: "Decommissioning", variant: "warning" },
  closed: { label: "Closed", variant: "neutral" },
};

export function ZoneStatusBadge({ status }: { status: ZoneStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "neutral" as const };
  return (
    <Badge variant={config.variant} data-testid={`zone-status-${status}`}>
      {config.label}
    </Badge>
  );
}

export function ZoneListPage() {
  const { tenant } = useTenant();
  const { data: zones, loading, error } = useAsyncResource(
    (token) => listZones(token, tenant),
    [tenant],
    { refetchIntervalMs: 15_000 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header-title">Tenant Zones</h1>
          <p className="text-sm text-muted-foreground">
            Isolation zones carved out for tenants — cloud account, EKS cluster, and wiring per
            zone.
          </p>
        </div>
        <Link to={tenantLink(tenant, "tenant-zones/new")} className="btn btn-primary">Vend new zone</Link>
      </div>

      {error && (
        <Card>
          <div className="card-body">
            Failed to load zones: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !zones && (
        <p className="text-sm text-muted-foreground">Loading zones…</p>
      )}

      {!error && zones && zones.length === 0 && (
        <Card>
          <div className="card-body">
            <p className="text-sm text-muted-foreground">
              No tenant zones yet. Vend a zone to get a dedicated cloud account, EKS cluster, and
              platform wiring.
            </p>
            <Link to={tenantLink(tenant, "tenant-zones/new")} className="btn btn-primary">Vend your first zone</Link>
          </div>
        </Card>
      )}

      {zones && zones.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Org unit</th>
                <th className="px-4 py-2 font-medium">Region</th>
                <th className="px-4 py-2 font-medium">Tier</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link
                      to={tenantLink(tenant, `tenant-zones/${zone.id}`)}
                      className="font-medium text-primary hover:underline"
                    >
                      {zone.name}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {zone.slug}
                    </span>
                  </td>
                  <td className="px-4 py-2">{zone.orgUnit}</td>
                  <td className="px-4 py-2 font-mono text-xs">{zone.region}</td>
                  <td className="px-4 py-2">
                    <Badge variant="neutral">{zone.tier}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <ZoneStatusBadge status={zone.status} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatRelative(zone.createdAt)}
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
