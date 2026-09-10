import * as React from "react";

import { useAuth } from "@/auth/auth-context";
import { useTenant } from "@/tenant/tenant-context";

export interface OrgCapabilities {
  isAdmin: boolean;
  canWriteSettings: boolean;
}

// Conservative derivation (Slice 1 decision): the org role is read from the
// token's `organization` claim when it carries one (`role` string or `roles`
// array containing "admin"); otherwise the user is treated as a viewer.
// Precise per-org roles land with the W2 members routes.
export function useOrgCapabilities(): OrgCapabilities {
  const { parsedToken } = useAuth();
  const { tenant } = useTenant();

  return React.useMemo(() => {
    const claim = parsedToken?.["organization"];
    let isAdmin = false;
    if (claim && typeof claim === "object" && !Array.isArray(claim)) {
      const value = (claim as Record<string, unknown>)[tenant];
      if (value && typeof value === "object") {
        const { role, roles } = value as { role?: unknown; roles?: unknown };
        isAdmin =
          role === "admin" ||
          (Array.isArray(roles) && roles.includes("admin"));
      }
    }
    return { isAdmin, canWriteSettings: isAdmin };
  }, [parsedToken, tenant]);
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
