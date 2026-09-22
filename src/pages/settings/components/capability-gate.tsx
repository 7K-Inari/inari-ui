import * as React from "react";

import { useAuth } from "@/auth/auth-context";
import { usePermissions } from "@/auth/permissions-context";
import { useTenant } from "@/tenant/tenant-context";

export interface OrgCapabilities {
  isAdmin: boolean;
  canWriteSettings: boolean;
}

// The org role comes from the server (`GET /me/permissions` → orgRoles,
// via PermissionsProvider), which reflects the authoritative FGA state.
// The token's `organization` claim carries only slugs (no role), so a
// token-only derivation silently degrades every user to viewer — the
// read-only-UI incident of 2026-09-16. The token claim remains the fallback
// for older servers that do not return orgRoles yet.
export function useOrgCapabilities(): OrgCapabilities {
  const { parsedToken } = useAuth();
  const { tenant } = useTenant();
  const { orgRoles } = usePermissions();

  const tokenAdmin = React.useMemo(() => {
    const claim = parsedToken?.["organization"];
    if (claim && typeof claim === "object" && !Array.isArray(claim)) {
      const value = (claim as Record<string, unknown>)[tenant];
      if (value && typeof value === "object") {
        const { role, roles } = value as { role?: unknown; roles?: unknown };
        return (
          role === "admin" ||
          role === "org-admin" ||
          (Array.isArray(roles) &&
            (roles.includes("admin") || roles.includes("org-admin")))
        );
      }
    }
    return false;
  }, [parsedToken, tenant]);

  const serverRole = orgRoles?.[tenant];
  const isAdmin =
    serverRole !== undefined ? serverRole === "org-admin" : tokenAdmin;
  return { isAdmin, canWriteSettings: isAdmin };
}

export function CapabilityGate({
  capability = "admin",
  children,
  fallback = null,
}: {
  capability?: "viewer" | "admin";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isAdmin } = useOrgCapabilities();
  if (capability === "admin" && !isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}
