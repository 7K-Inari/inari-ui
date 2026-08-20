import { Link } from "react-router-dom";

import { useAsyncResource } from "@/api/hooks";
import type { ZoneStatus } from "@/api/zones";
import { listZones } from "@/api/zones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const STATUS_CONFIG: Record<
  ZoneStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "muted" }
> = {
  active: { label: "Active", variant: "success" },
  provisioning: { label: "Provisioning", variant: "warning" },
  decommission_requested: { label: "Decommission requested", variant: "warning" },
  decommissioning: { label: "Decommissioning", variant: "warning" },
  decommissioned: { label: "Decommissioned", variant: "muted" },
  failed: { label: "Failed", variant: "destructive" },
};

export function ZoneStatusBadge({ status }: { status: ZoneStatus }) {
  const config = STATUS_CONFIG[status];
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
          <h1 className="text-2xl font-semibold tracking-tight">Tenant Zones</h1>
          <p className="text-sm text-muted-foreground">
            Isolation zones carved out for tenants — cloud account, EKS cluster, and wiring per
            zone.
          </p>
        </div>
        <Button asChild>
          <Link to={tenantLink(tenant, "tenant-zones/new")}>Vend new zone</Link>
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load zones: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !zones && (
        <p className="text-sm text-muted-foreground">Loading zones…</p>
      )}

      {!error && zones && zones.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No tenant zones yet. Vend a zone to get a dedicated cloud account, EKS cluster, and
              platform wiring.
            </p>
            <Button asChild>
              <Link to={tenantLink(tenant, "tenant-zones/new")}>Vend your first zone</Link>
            </Button>
          </CardContent>
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
                <th className="px-4 py-2 font-medium">Progress</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => {
                const done = zone.steps.filter((s) => s.status === "done").length;
                return (
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
                      <Badge variant="outline">{zone.tier}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <ZoneStatusBadge status={zone.status} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {done}/{zone.steps.length} steps
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatRelative(zone.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
