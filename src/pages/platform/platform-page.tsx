import { listCatalogItems } from "@/api/catalog";
import { useAsyncResource } from "@/api/hooks";
import type { PlatformResourceKind, PlatformResourceStatus } from "@/api/platform";
import { listTenantPlatformResources } from "@/api/platform";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  ready: { label: "Ready", variant: "success" },
  reconciling: { label: "Reconciling", variant: "warning" },
  failed: { label: "Failed", variant: "destructive" },
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
        <h1 className="text-2xl font-semibold tracking-tight">Platform</h1>
        <p className="text-sm text-muted-foreground">
          Apps running on the platform cluster and the platform resources reconciled for this
          tenant.
        </p>
      </div>

      <section className="space-y-3" aria-label="Platform cluster apps">
        <h2 className="text-lg font-semibold tracking-tight">Platform cluster apps</h2>
        {apps.error && (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              Failed to load platform apps: {apps.error.message}
            </CardContent>
          </Card>
        )}
        {!apps.error && apps.loading && !apps.data && (
          <p className="text-sm text-muted-foreground">Loading platform apps…</p>
        )}
        {!apps.error && apps.data && apps.data.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No platform apps discovered yet.
            </CardContent>
          </Card>
        )}
        {apps.data && apps.data.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.data.map((item) => (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{item.displayName}</CardTitle>
                    {item.latestVersion && (
                      <Badge variant="outline" className="font-mono">
                        {item.latestVersion}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="font-mono text-xs">{item.name}</CardDescription>
                </CardHeader>
                {item.description && (
                  <CardContent className="text-sm text-muted-foreground">
                    {item.description}
                  </CardContent>
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
            <CardContent className="py-6 text-sm text-destructive">
              Failed to load platform resources: {resources.error.message}
            </CardContent>
          </Card>
        )}
        {!resources.error && resources.loading && !resources.data && (
          <p className="text-sm text-muted-foreground">Loading platform resources…</p>
        )}
        {!resources.error && resources.data && resources.data.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No platform resources for this tenant yet.
            </CardContent>
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
                  const status = RESOURCE_STATUS[r.status];
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Badge variant="outline">{KIND_LABELS[r.kind]}</Badge>
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
