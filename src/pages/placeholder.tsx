import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS } from "@/tenant/tenant-link";

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { tenant, team } = useTenant();
  const scope =
    tenant === ALL_TENANTS
      ? "All tenants"
      : team
        ? `${tenant} / ${team}`
        : tenant;

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="text-xs text-muted-foreground">
        Scope: <span className="font-mono">{scope}</span> — this page is a
        placeholder and ships in a later milestone.
      </p>
    </div>
  );
}

export function AllTenantsHome() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">All tenants</h1>
      <p className="text-sm text-muted-foreground">
        Aggregated resources, pending approvals, and notifications across every
        organization you belong to will appear here.
      </p>
    </div>
  );
}
