import { Link } from "react-router-dom";
import { Card } from "7k-design-system/react";

import type { TenantPermissions } from "@/api/me";
import { usePermissions } from "@/auth/permissions-context";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

interface QuickAction {
  label: string;
  path: string;
  flag?: keyof TenantPermissions;
}

const ACTIONS: QuickAction[] = [
  { label: "Register cluster", path: "clusters/new", flag: "canRegisterClusters" },
  { label: "Browse catalog", path: "catalog" },
  { label: "Connect cloud account", path: "cloud-accounts/new", flag: "canConnectCloudAccounts" },
  { label: "New deploy", path: "catalog", flag: "canDeploy" },
];

// Entry points gated by the per-tenant permission projection. The server does
// not project per-tenant flags yet (only global /me/permissions), so an absent
// flag means "unknown" and the action stays visible — destination pages
// enforce authz. An explicit `false` hides the action.
export function QuickActionsCard() {
  const { tenant } = useTenant();
  const permissions = usePermissions();
  const tenantPerms = permissions.tenants?.[tenant];

  const visible = ACTIONS.filter((a) => !a.flag || tenantPerms?.[a.flag] !== false);

  return (
    <Card data-testid="card-quick-actions">
      <div className="card-header overview-card-header">
        <span className="mono-label">Quick actions</span>
      </div>
      <div className="card-body">
        <ul className="list">
          {visible.map((a) => (
            <li key={a.label} className="list-item">
              <Link to={tenantLink(tenant, a.path)} className="overview-card-link">
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
