import { Building2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, Button, Skeleton } from "7k-design-system/react";

import type { AsyncState } from "@/api/hooks";
import type { Tenant } from "@/api/tenants";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

// Org rows for the all-tenants home. Recents come from the tenant-switcher
// state (localStorage-backed, maintained by TenantProvider), filtered to orgs
// the caller can actually see.
export function TenantStrip({ state }: { state: AsyncState<Tenant[]> }) {
  const { recents } = useTenant();
  const { data, loading, error, refetch } = state;

  if (error && !data) {
    return (
      <Alert variant="danger" data-testid="tenant-strip">
        <span>Failed to load: {error.message}</span>
        <Button variant="secondary" size="sm" onClick={refetch}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!data && loading) {
    return (
      <div className="overview-card-skeleton" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={40} />
        ))}
      </div>
    );
  }

  const tenants = data ?? [];
  if (tenants.length === 0) {
    return (
      <div className="empty" data-testid="tenant-strip">
        <span className="empty-text">
          You don't belong to any organizations yet.{" "}
          <Link to="/create-organization" className="overview-card-link">
            Create one
          </Link>
        </span>
      </div>
    );
  }

  const recentTenants = recents
    .map((id) => tenants.find((t) => t.slug === id))
    .filter((t): t is Tenant => t !== undefined);

  return (
    <div className="tenant-strip" data-testid="tenant-strip">
      {recentTenants.length > 0 && (
        <div className="tenant-strip-recents">
          <span className="mono-label">Recent</span>
          {recentTenants.map((t) => (
            <span key={t.slug} data-testid={`recent-${t.slug}`}>
              <Link to={tenantLink(t.slug, "overview")} className="tag">
                {t.displayName}
              </Link>
            </span>
          ))}
        </div>
      )}
      <ul className="list">
        {tenants.map((t) => (
          <li key={t.slug}>
            <Link to={tenantLink(t.slug, "overview")} className="list-item tenant-row">
              <Building2 size={16} aria-hidden="true" className="tenant-row-icon" />
              <span className="tenant-row-name mono-data">{t.displayName}</span>
              <span className="tag">{t.slug}</span>
              <ChevronRight size={16} aria-hidden="true" className="tenant-row-chevron" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
