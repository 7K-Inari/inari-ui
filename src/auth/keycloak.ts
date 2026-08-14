import Keycloak from "keycloak-js";

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? "inari",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "inari-ui",
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
