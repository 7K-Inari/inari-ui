import * as React from "react";

import { useAuth } from "@/auth/auth-context";
import { usePermissions } from "@/auth/permissions-context";
import { useTenant } from "@/tenant/tenant-context";

export interface OrgCapabilities {
  isAdmin: boolean;
  canWriteSettings: boolean;
  canManageMembers: boolean;
  canManageTeams: boolean;
  canManageRbac: boolean;
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
  const { orgRoles, tenants } = usePermissions();

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

  // Per-capability flags come from the `tenants` projection on
  // GET /me/permissions (M1.W1). An absent projection is "unknown", never a
  // denial: fall back to the admin-derived default so older servers keep the
  // current behavior (org admins can manage everything).
  const projection = tenants?.[tenant];
  return {
    isAdmin,
    canWriteSettings: isAdmin,
    canManageMembers: projection?.canManageMembers ?? isAdmin,
    canManageTeams: projection?.canManageTeams ?? isAdmin,
    canManageRbac: projection?.canManageRbac ?? isAdmin,
  };
}

export type Capability =
  | "viewer"
  | "admin"
  | "manageMembers"
  | "manageTeams"
  | "manageRbac";

const CAPABILITY_REASON: Record<Exclude<Capability, "viewer">, string> = {
  admin: "Requires org admin",
  manageMembers: "Requires member management permission",
  manageTeams: "Requires team management permission",
  manageRbac: "Requires role management permission",
};

export function CapabilityGate({
  capability = "admin",
  mode = "hide",
  disabledReason,
  children,
  fallback = null,
}: {
  capability?: Capability;
  // "hide" unmounts (renders fallback); "disable" renders the children inert
  // with a tooltip naming the missing permission instead of unmounting.
  mode?: "hide" | "disable";
  disabledReason?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const caps = useOrgCapabilities();
  const allowed =
    capability === "viewer" ||
    (capability === "admin"
      ? caps.isAdmin
      : capability === "manageMembers"
        ? caps.canManageMembers
        : capability === "manageTeams"
          ? caps.canManageTeams
          : caps.canManageRbac);
  if (allowed) return <>{children}</>;
  if (mode === "disable") {
    // Unreachable for "viewer" (always allowed), so capability is the
    // non-viewer subset here.
    const reason = disabledReason ?? CAPABILITY_REASON[capability];
    return (
      <span
        className="inline-block cursor-not-allowed"
        title={reason}
        aria-disabled="true"
      >
        <span className="pointer-events-none opacity-50">{children}</span>
      </span>
    );
  }
  return <>{fallback}</>;
}
