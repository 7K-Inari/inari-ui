import Keycloak from "keycloak-js";

import { hasOrganization, readCachedOrganizations } from "@/auth/orgs";
import { config } from "@/config";

const PENDING_ORG_KEY = "inari-pending-org";
const FALLBACK_ATTEMPTED_KEY = "inari-org-fallback-attempted";

export const keycloak = new Keycloak({
  url: config.keycloakUrl,
  realm: config.keycloakRealm,
  clientId: config.keycloakClientId,
});

let refreshInterval: ReturnType<typeof setInterval> | undefined;
let initPromise: Promise<boolean> | undefined;

export async function initKeycloak(): Promise<boolean> {
  if (!initPromise) {
    initPromise = keycloak
      .init({
        onLoad: "login-required",
        scope: "openid organization",
        checkLoginIframe: false,
      })
      .catch((err) => {
        initPromise = undefined;
        throw err;
      });
  }
  const authenticated = await initPromise;

  if (!refreshInterval) {
    refreshInterval = setInterval(() => {
      keycloak.updateToken(30).catch(() => {
        keycloak.login();
      });
    }, 10_000);
  }

  return authenticated;
}

export function stopTokenRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }
}

function organizationScope(alias: string): string {
  return `openid organization:${alias}`;
}

export function peekPendingOrg(): string | null {
  try {
    return sessionStorage.getItem(PENDING_ORG_KEY);
  } catch {
    return null;
  }
}

export function consumePendingOrg(): string | null {
  const pending = peekPendingOrg();
  try {
    sessionStorage.removeItem(PENDING_ORG_KEY);
    sessionStorage.removeItem(FALLBACK_ATTEMPTED_KEY);
  } catch {
    // sessionStorage unavailable; nothing to clear
  }
  return pending;
}

export function switchOrganization(alias: string): boolean {
  if (!alias || /\s/.test(alias)) {
    return false;
  }
  if (
    !hasOrganization(keycloak.tokenParsed, alias) &&
    !readCachedOrganizations().some((org) => org.id === alias)
  ) {
    return false;
  }
  try {
    sessionStorage.setItem(PENDING_ORG_KEY, alias);
    sessionStorage.removeItem(FALLBACK_ATTEMPTED_KEY);
  } catch {
    // sessionStorage unavailable; continue without pending-org marker
  }
  void keycloak.login({ prompt: "none", scope: organizationScope(alias) });
  return true;
}

export function handleAuthInitFailure(): boolean {
  const pending = peekPendingOrg();
  if (!pending) {
    return false;
  }
  let attempted = false;
  try {
    attempted = sessionStorage.getItem(FALLBACK_ATTEMPTED_KEY) !== null;
  } catch {
    // sessionStorage unavailable
  }
  if (attempted) {
    consumePendingOrg();
    return false;
  }
  try {
    sessionStorage.setItem(FALLBACK_ATTEMPTED_KEY, "1");
  } catch {
    // sessionStorage unavailable
  }
  void keycloak.login({ scope: organizationScope(pending) });
  return true;
}
