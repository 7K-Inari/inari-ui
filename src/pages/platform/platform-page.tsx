import { listCatalogItems } from "@/api/catalog";
import { useAsyncResource } from "@/api/hooks";
import type { PlatformResourceKind, PlatformResourceStatus } from "@/api/platform";
import { listTenantPlatformResources } from "@/api/platform";
import { Badge } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";

const KIND_LABELS: Record<PlatformResourceKind, string> = {
  "keycloak-realm": "Keycloak realm",
  "keycloak-client": "Keycloak client",
  "dns-zone": "DNS zone",
  "tenant-namespace": "Namespace",
};

const RESOURCE_STATUS: Record<
  PlatformResourceStatus,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  ready: { label: "Ready", variant: "success" },
  reconciling: { label: "Reconciling", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
};

export function PlatformPage() {
  const { tenant } = useTenant();

  const apps = useAsyncResource(
    (token) => listCatalogItems(token, tenant, { source: "platform" }),
    [tenant],
  );
  const resources = useAsyncResource(
    (token) => listTenantPlatformResources(token, tenant),
    [tenant],
    { refetchIntervalMs: 15_000 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header-title">Platform</h1>
        <p className="text-sm text-muted-foreground">
          Apps running on the platform cluster and the platform resources reconciled for this
          tenant.
        </p>
      </div>

      <section className="space-y-3" aria-label="Platform cluster apps">
        <h2 className="text-lg font-semibold tracking-tight">Platform cluster apps</h2>
        {apps.error && (
          <Card>
            <div className="card-body">
              Failed to load platform apps: {apps.error.message}
            </div>
          </Card>
        )}
        {!apps.error && apps.loading && !apps.data && (
          <p className="text-sm text-muted-foreground">Loading platform apps…</p>
        )}
        {!apps.error && apps.data && apps.data.items.length === 0 && (
          <Card>
            <div className="card-body">
              No platform apps discovered yet.
            </div>
          </Card>
        )}
        {apps.data && apps.data.items.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.data.items.map((item) => (
              <Card key={item.id}>
                <div className="card-header">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="mono-label">{item.displayName}</h2>
                    {item.latestVersion && (
                      <Badge variant="neutral" className="font-mono">
                        {item.latestVersion}
                      </Badge>
                    )}
                  </div>
                  <p className="card-lede">{item.name}</p>
                </div>
                {item.description && (
                  <div className="card-body">
                    {item.description}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-label="Tenant platform resources">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tenant platform resources</h2>
          <p className="text-sm text-muted-foreground">
            Reconciled by inari-operator: Keycloak realm and clients, DNS zone, and tenant
            namespaces.
          </p>
        </div>
        {resources.error && (
          <Card>
            <div className="card-body">
              Failed to load platform resources: {resources.error.message}
            </div>
          </Card>
        )}
        {!resources.error && resources.loading && !resources.data && (
          <p className="text-sm text-muted-foreground">Loading platform resources…</p>
        )}
        {!resources.error && resources.data && resources.data.length === 0 && (
          <Card>
            <div className="card-body">
              No platform resources for this tenant yet.
            </div>
          </Card>
        )}
        {resources.data && resources.data.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                  <th className="px-4 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {resources.data.map((r) => {
                  // Contract types kind/status as plain strings; fall back to
                  // the raw value for anything outside the known sets.
                  const kind = r.kind as PlatformResourceKind;
                  const status = RESOURCE_STATUS[r.status as PlatformResourceStatus] ?? {
                    label: r.status,
                    variant: "secondary" as const,
                  };
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Badge variant="neutral">{KIND_LABELS[kind] ?? r.kind}</Badge>
                      </td>
                      <td className="px-4 py-2 font-medium">{r.name}</td>
                      <td className="px-4 py-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.detail}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatRelative(r.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
