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
  withExtensionSessionRetry,
} from "@/ext/sso-session";

// Shell-side session bootstrap seam for `oidc-sso-session` extensions (W4).
// The SDK ApiClient (0.1.7) owns wire parsing and typed-error classification
// for `invokeExtension`; the shell owns the zero-prompt round-trip, the
// retry-once policy, and never exposes session material to extension code.
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
  // Runs an extension action (typically an SDK `invokeExtension` call). On
  // first use without a cached session this bootstraps first; on a typed
  // session-expired error it force-re-bootstraps and retries exactly once.
  runWithSession: <T>(
    extensionId: string,
    options: { ssoLoginBaseUrl: string; returnTo?: string },
    action: () => Promise<T>,
  ) => Promise<T>;
}

const ExtensionSessionContext = React.createContext<ExtensionSessionState | null>(null);

export function useExtensionSession(): ExtensionSessionState {
  const ctx = React.useContext(ExtensionSessionContext);
  if (!ctx) throw new Error("useExtensionSession must be used within ExtensionHostProviders");
  return ctx;
}

// SlotContext passed to Page slot components: the SDK contract plus the
// shell-owned extension-session seam (bootstrap + retry-once) so extensions
// can run session-aware actions without reimplementing them.
export type HostSlotContext = SlotContext & { extensionSession: ExtensionSessionState };

// Builds the SlotContext passed to Page slot components.
export function useSdkSlotContext(): HostSlotContext {
  const auth = useSdkAuth();
  const tenant = useSdkTenant();
  const extensionSession = useExtensionSession();
  return React.useMemo(
    () => ({ auth, tenant, extensionSession }),
    [auth, tenant, extensionSession],
  );
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

  const extensionSession = React.useMemo<ExtensionSessionState>(() => {
    const bootstrap: ExtensionSessionState["bootstrapSession"] = (extensionId, options) => {
      if (tenant.tenant === ALL_TENANTS) {
        return Promise.reject(new Error("extension sessions require a specific tenant context"));
      }
      if (options.force) clearExtensionSession(tenant.tenant, extensionId);
      if (hasExtensionSession(tenant.tenant, extensionId)) return Promise.resolve();
      beginExtensionSsoRedirect({
        tenant: tenant.tenant,
        extensionId,
        ssoLoginBaseUrl: options.ssoLoginBaseUrl,
        returnTo: options.returnTo ?? `${window.location.pathname}${window.location.search}`,
      });
      // Real navigation unloads the page, so this promise never settles. If
      // the session is already observable (test doubles, same-tab completion)
      // resolve instead of hanging the caller.
      if (hasExtensionSession(tenant.tenant, extensionId)) return Promise.resolve();
      return new Promise<void>(() => {});
    };
    return {
      hasSession: (extensionId) =>
        tenant.tenant !== ALL_TENANTS && hasExtensionSession(tenant.tenant, extensionId),
      bootstrapSession: bootstrap,
      runWithSession: (extensionId, options, action) => {
        if (tenant.tenant !== ALL_TENANTS && !hasExtensionSession(tenant.tenant, extensionId)) {
          // First use: bootstrap before the action ever runs (navigates away).
          return bootstrap(extensionId, options).then(action);
        }
        return withExtensionSessionRetry(action, {
          reauth: () => bootstrap(extensionId, { ...options, force: true }),
        });
      },
    };
  }, [tenant]);

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
