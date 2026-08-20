import * as React from "react";
import {
  AuthProvider as SdkAuthProvider,
  TenantProvider as SdkTenantProvider,
  type AuthState as SdkAuthState,
  type TenantState as SdkTenantState,
  type TenantRef,
} from "@inari/ui-plugin-sdk";

import { useAuth } from "@/auth/auth-context";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS } from "@/tenant/tenant-link";

// Bridges the shell's auth/tenant state into the SDK host contexts so
// extension components can use the SDK's useAuth()/useTenant() hooks and
// receive the same identity and tenant scope as the shell (§8.1).

export function ExtensionHostProviders({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const tenant = useTenant();

  const sdkAuth = React.useMemo<SdkAuthState>(
    () => ({
      principal: auth.parsedToken
        ? {
            subject: String(auth.parsedToken.sub ?? ""),
            displayName: String(
              auth.parsedToken.name ?? auth.parsedToken.preferred_username ?? "",
            ),
            groups: Array.isArray(auth.parsedToken.groups)
              ? (auth.parsedToken.groups as string[])
              : [],
          }
        : null,
      getToken: () => auth.token,
    }),
    [auth.parsedToken, auth.token],
  );

  const sdkTenant = React.useMemo<SdkTenantState>(() => {
    const available: TenantRef[] = tenant.orgs.map((o) => ({
      orgId: o.id,
      orgName: o.name,
    }));
    const currentOrg = tenant.orgs.find((o) => o.id === tenant.tenant);
    const current: TenantRef | null =
      tenant.tenant === ALL_TENANTS || !currentOrg
        ? null
        : {
            orgId: currentOrg.id,
            orgName: currentOrg.name,
            team: tenant.team ?? undefined,
          };
    return {
      current,
      available,
      switchTenant: (orgId: string, team?: string) => {
        tenant.setTenant(orgId);
        tenant.setTeam(team ?? null);
      },
      // The shell drives tenant changes via the URL; extensions observe them
      // through context re-renders, so this is a no-op subscription.
      onTenantChange: () => () => {},
    };
  }, [tenant]);

  return (
    <SdkAuthProvider value={sdkAuth}>
      <SdkTenantProvider value={sdkTenant}>{children}</SdkTenantProvider>
    </SdkAuthProvider>
  );
}
