import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { AsyncState } from "@/api/hooks";
import type { Tenant } from "@/api/tenants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

// Org cards for the all-tenants home. Recents come from the tenant-switcher
// state (localStorage-backed, maintained by TenantProvider), filtered to orgs
// the caller can actually see.
export function TenantStrip({ state }: { state: AsyncState<Tenant[]> }) {
  const { recents } = useTenant();
  const { data, loading, error, refetch } = state;

  if (error && !data) {
    return (
      <div className="flex flex-col items-start gap-3 py-2" data-testid="tenant-strip">
        <p className="text-sm text-destructive">Failed to load: {error.message}</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data && loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const tenants = data ?? [];
  if (tenants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="tenant-strip">
        You don't belong to any organizations yet.{" "}
        <Link to="/create-organization" className="text-primary hover:underline">
          Create one
        </Link>
      </p>
    );
  }

  const recentTenants = recents
    .map((id) => tenants.find((t) => t.slug === id))
    .filter((t): t is Tenant => t !== undefined);

  return (
    <div className="space-y-4" data-testid="tenant-strip">
      {recentTenants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Recent</span>
          {recentTenants.map((t) => (
            <span
              key={t.slug}
              data-testid={`recent-${t.slug}`}
              className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs"
            >
              <Link to={tenantLink(t.slug, "overview")} className="hover:underline">
                {t.displayName}
              </Link>
            </span>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map((t) => (
          <Link key={t.slug} to={tenantLink(t.slug, "overview")} className="block">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="flex items-center gap-3 py-4">
                <Building2 className="shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.displayName}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{t.slug}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
