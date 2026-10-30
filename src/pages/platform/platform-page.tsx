import { Link } from "react-router-dom";
import { listCatalogItems } from "@/api/catalog";
import { useAsyncResource } from "@/api/hooks";
import { Badge } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { LoadingState } from "@/components/loading";

export function PlatformPage() {
  const { tenant } = useTenant();

  const apps = useAsyncResource(
    (token) => listCatalogItems(token, tenant, { source: "platform" }),
    [tenant],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header-title">Platform</h1>
        <p className="text-sm u-muted">
          Apps running on the platform cluster and the platform resources rendered for this
          tenant.
        </p>
      </div>

      <section className="space-y-3" aria-label="Platform cluster apps">
        <h2 className="mono-label">Platform cluster apps</h2>
        {apps.error && (
          <Card>
            <div className="card-body">
              Failed to load platform apps: {apps.error.message}
            </div>
          </Card>
        )}
        {!apps.error && apps.loading && !apps.data && (
          <LoadingState label="Loading platform apps…" />
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
        <Card>
          <div className="card-body space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-base font-medium">Tenant platform resources</h2>
              <Link to={tenantLink(tenant, "deploys")} className="mono-label u-accent inline-block -my-1.5 py-1.5">
                Resources view →
              </Link>
            </div>
            <p className="text-sm u-muted">
              Native cert-manager ClusterIssuers, ExternalDNS DNSEndpoints, ArgoCD AppProjects,
              and KRO tenant namespaces — rendered into this tenant's GitOps state repos and
              synced by ArgoCD — live in the Resources view. The backing addons are managed from
              each cluster's Addons page.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
