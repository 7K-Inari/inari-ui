import { Link } from "react-router-dom";

import type { TenantPermissions } from "@/api/me";
import { usePermissions } from "@/auth/permissions-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {visible.map((a) => (
            <li key={a.label}>
              <Link
                to={tenantLink(tenant, a.path)}
                className="text-sm text-primary hover:underline"
              >
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
