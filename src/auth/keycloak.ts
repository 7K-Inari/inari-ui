import Keycloak from "keycloak-js";

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? "inari",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "inari-ui",
});

export async function initKeycloak(): Promise<boolean> {
  const authenticated = await keycloak.init({
    onLoad: "login-required",
    scope: "openid organization",
    checkLoginIframe: false,
  });

  setInterval(() => {
    keycloak.updateToken(30).catch(() => {
      keycloak.login();
    });
  }, 10_000);

  return authenticated;
}
