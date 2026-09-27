import * as React from "react";
import {
  AuthProvider as SdkAuthProvider,
  TenantProvider as SdkTenantProvider,
  useAuth as useSdkAuth,
  useTenant as useSdkTenant,
  type AuthState as SdkAuthState,
  type SlotContext,
  type TenantState as SdkTenantState,
  type TenantRef,
} from "@7k-inari/ui-plugin-sdk";

import { useAuth } from "@/auth/auth-context";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS } from "@/tenant/tenant-link";
import {
  beginExtensionSsoRedirect,
  clearExtensionSession,
  hasExtensionSession,
} from "@/ext/sso-session";

// Shell-side session bootstrap seam for `oidc-sso-session` extensions (W4).
// The SDK ApiClient (W4, parallel) calls `bootstrapSession` on typed
// session-expired responses; the shell owns the zero-prompt round-trip and
// never exposes session material to extension code.
export interface ExtensionSessionState {
  hasSession: (extensionId: string) => boolean;
  // Starts the SSO round-trip. On a cache hit this resolves immediately;
  // otherwise the browser navigates away and the promise never settles.
  // Pass `force: true` when reacting to a server-typed session-expired error:
  // the cached entry is stale and must be dropped so the round-trip re-runs.
  bootstrapSession: (
    extensionId: string,
    options: { ssoLoginBaseUrl: string; returnTo?: string; force?: boolean },
  ) => Promise<void>;
}

const ExtensionSessionContext = React.createContext<ExtensionSessionState | null>(null);

export function useExtensionSession(): ExtensionSessionState {
  const ctx = React.useContext(ExtensionSessionContext);
  if (!ctx) throw new Error("useExtensionSession must be used within ExtensionHostProviders");
  return ctx;
}

// Builds the SlotContext passed to Page slot components.
export function useSdkSlotContext(): SlotContext {
  const auth = useSdkAuth();
  const tenant = useSdkTenant();
  return React.useMemo(() => ({ auth, tenant }), [auth, tenant]);
}

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

  const extensionSession = React.useMemo<ExtensionSessionState>(
    () => ({
      hasSession: (extensionId) =>
        tenant.tenant !== ALL_TENANTS && hasExtensionSession(tenant.tenant, extensionId),
      bootstrapSession: (extensionId, options) => {
        if (tenant.tenant === ALL_TENANTS) {
          return Promise.reject(
            new Error("extension sessions require a specific tenant context"),
          );
        }
        if (options.force) clearExtensionSession(tenant.tenant, extensionId);
        if (hasExtensionSession(tenant.tenant, extensionId)) return Promise.resolve();
        beginExtensionSsoRedirect({
          tenant: tenant.tenant,
          extensionId,
          ssoLoginBaseUrl: options.ssoLoginBaseUrl,
          returnTo:
            options.returnTo ?? `${window.location.pathname}${window.location.search}`,
        });
        return new Promise<void>(() => {});
      },
    }),
    [tenant],
  );

  return (
    <SdkAuthProvider value={sdkAuth}>
      <SdkTenantProvider value={sdkTenant}>
        <ExtensionSessionContext.Provider value={extensionSession}>
          {children}
        </ExtensionSessionContext.Provider>
      </SdkTenantProvider>
    </SdkAuthProvider>
  );
}
