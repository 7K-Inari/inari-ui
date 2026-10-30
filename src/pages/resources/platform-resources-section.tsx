import { Link } from "react-router-dom";
import { Badge, Card, DataTable, type DataTableColumn } from "7k-design-system/react";

import { useAsyncResource } from "@/api/hooks";
import {
  listTenantPlatformResources,
  platformResourceKindInfo,
  type PlatformResourceManagement,
  type PlatformResourceStatus,
  type TenantPlatformResource,
} from "@/api/platform";
import { LoadingState } from "@/components/loading";
import { formatRelative } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS, tenantLink } from "@/tenant/tenant-link";

const STATUS_BADGE: Record<PlatformResourceStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  ready: { label: "Ready", variant: "success" },
  reconciling: { label: "Reconciling", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
};

function ManagementHint({
  management,
  tenant,
}: {
  management: PlatformResourceManagement | null;
  tenant: string;
}) {
  if (!management) {
    return <span className="u-muted">—</span>;
  }
  switch (management.type) {
    case "addon":
      // cert-manager/ExternalDNS/ArgoCD are first-class cluster addons; the
      // addons page is their install/upgrade/values surface.
      return (
        <Link to={tenantLink(tenant, "clusters")} className="table-link">
          {management.addon} addon
        </Link>
      );
    case "kro":
      return <span className="u-muted">KRO tenantnamespace</span>;
    case "platform":
      return <span className="u-muted">Platform hub</span>;
  }
}

// PlatformResourcesSection surfaces the tenant's platform resources — DNS
// records (native ExternalDNS DNSEndpoints), tenant namespaces (KRO
// tenantnamespace instances), and hub-side Keycloak realm/clients — rendered
// by inari-server into GitOps state repos and synced by ArgoCD. It replaces
// the old inari-operator facade CRD (platform.inari.io) display.
export function PlatformResourcesSection() {
  const { tenant } = useTenant();
  const isAllTenants = tenant === ALL_TENANTS;
  const { data, loading, error } = useAsyncResource(
    (token) => listTenantPlatformResources(token, tenant),
    [tenant],
    { enabled: !isAllTenants, refetchIntervalMs: 15_000 },
  );

  if (isAllTenants) {
    return null;
  }

  const columns: DataTableColumn<TenantPlatformResource>[] = [
    {
      key: "kind",
      label: "Kind",
      render: (r) => {
        const { label } = platformResourceKindInfo(r.kind);
        return <Badge variant="neutral">{label}</Badge>;
      },
    },
    { key: "name", label: "Name" },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const status = STATUS_BADGE[r.status as PlatformResourceStatus] ?? {
          label: r.status,
          variant: "neutral" as const,
        };
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    { key: "detail", label: "Detail" },
    {
      key: "management",
      label: "Managed by",
      render: (r) => (
        <ManagementHint management={platformResourceKindInfo(r.kind).management} tenant={tenant} />
      ),
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (r) => <span className="u-muted">{formatRelative(r.updatedAt)}</span>,
    },
  ];

  return (
    <section className="space-y-3" aria-label="Platform resources">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Platform resources</h2>
        <p className="text-sm u-muted">
          Rendered into this tenant's GitOps state repos and synced by ArgoCD: native ExternalDNS
          DNSEndpoints, KRO tenantnamespace instances, plus cert-manager ClusterIssuers and ArgoCD
          AppProjects committed as native manifests. The backing addons — cert-manager,
          ExternalDNS, ArgoCD — are installed and managed from a cluster's{" "}
          <Link to={tenantLink(tenant, "clusters")} className="u-accent">
            Addons page
          </Link>
          .
        </p>
      </div>
      {error && (
        <Card>
          <div className="card-body">Failed to load platform resources: {error.message}</div>
        </Card>
      )}
      {!error && loading && !data && <LoadingState label="Loading platform resources…" />}
      {!error && data && data.length === 0 && (
        <Card>
          <div className="card-body">
            <p className="text-sm u-muted">No platform resources for this tenant yet.</p>
          </div>
        </Card>
      )}
      {data && data.length > 0 && (
        <DataTable<TenantPlatformResource> columns={columns} rows={data} rowKey="id" />
      )}
    </section>
  );
}
