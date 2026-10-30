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
      // addons page is their install/upgrade/values surface. Rows carry no
      // cluster field, so the link targets the clusters list (design D2/G3).
      return (
        <Link to={tenantLink(tenant, "clusters")} className="table-link inline-block -my-1.5 py-1.5">
          {management.addon} addon
        </Link>
      );
    case "kro":
      return <span className="u-muted">KRO tenantnamespace</span>;
    case "platform":
      return <span className="u-muted">Platform hub</span>;
  }
}

function Detail({ resource }: { resource: TenantPlatformResource }) {
  if (!resource.detail) {
    return <span className="u-muted">—</span>;
  }
  // Failure detail reads in the danger foreground (design Screen 1 spec).
  if (resource.status === "failed") {
    return <span className="u-danger">{resource.detail}</span>;
  }
  return <span className="u-muted">{resource.detail}</span>;
}

// PlatformResourcesSection surfaces the tenant's platform resources — DNS
// records (native ExternalDNS DNSEndpoints), tenant namespaces (KRO
// tenantnamespace instances), and hub-side Keycloak realm/clients — rendered
// by inari-server into GitOps state repos and synced by ArgoCD. It replaces
// the old inari-operator facade CRD (platform.inari.io) display.
// Design source of truth: docs/design/m5w2-ui-resources-native/index.md
// (Penpot boards resources / resources--platform-*).
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
    {
      key: "detail",
      label: "Detail",
      render: (r) => <Detail resource={r} />,
    },
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
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="mono-label">Platform resources</h2>
        <Link
          to={tenantLink(tenant, "clusters")}
          className="mono-label u-accent inline-block -my-1.5 py-1.5"
        >
          Addons page →
        </Link>
      </div>
      <p className="text-sm u-muted">
        Native cert-manager ClusterIssuers, ExternalDNS DNSEndpoints, ArgoCD AppProjects, and KRO
        tenantnamespace instances rendered into this tenant's GitOps state repos and synced by
        ArgoCD.
      </p>
      {error && (
        <Card>
          <div className="card-body">Failed to load platform resources: {error.message}</div>
        </Card>
      )}
      {!error && loading && !data && (
        <Card>
          <div className="card-body">
            <LoadingState label="Loading platform resources…" rows={5} />
          </div>
        </Card>
      )}
      {!error && data && data.length === 0 && (
        <Card>
          <div className="card-body">
            <p className="font-medium">No platform resources yet</p>
            <p className="text-sm u-muted">
              Resources appear here as the platform renders them into this tenant's GitOps state
              repos — DNS endpoints, tenant namespaces, and Keycloak realms/clients.
            </p>
          </div>
        </Card>
      )}
      {data && data.length > 0 && (
        <DataTable<TenantPlatformResource> columns={columns} rows={data} rowKey="id" />
      )}
    </section>
  );
}
