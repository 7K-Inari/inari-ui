// Runtime configuration for the Inari console.
//
// The published bundle is environment-agnostic (plan §6: one artifact, many
// deploys). Deployments inject values by serving a `config.js` that sets
// `window.__INARI_CONFIG__` before the app loads; build-time VITE_* env vars
// remain the fallback for local dev.

declare global {
  interface Window {
    __INARI_CONFIG__?: {
      keycloakUrl?: string;
      keycloakRealm?: string;
      keycloakClientId?: string;
      apiBaseUrl?: string;
      agentGatewayUrl?: string;
    };
  }
}

export interface ConsoleConfig {
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  apiBaseUrl: string;
  agentGatewayUrl: string;
}

export const config: ConsoleConfig = {
  keycloakUrl:
    window.__INARI_CONFIG__?.keycloakUrl ??
    import.meta.env.VITE_KEYCLOAK_URL ??
    "http://localhost:8080",
  keycloakRealm:
    window.__INARI_CONFIG__?.keycloakRealm ??
    import.meta.env.VITE_KEYCLOAK_REALM ??
    "inari",
  keycloakClientId:
    window.__INARI_CONFIG__?.keycloakClientId ??
    import.meta.env.VITE_KEYCLOAK_CLIENT_ID ??
    "inari-ui",
  apiBaseUrl:
    window.__INARI_CONFIG__?.apiBaseUrl ??
    import.meta.env.VITE_API_BASE_URL ??
    "/api/v1",
  agentGatewayUrl:
    window.__INARI_CONFIG__?.agentGatewayUrl ??
    import.meta.env.VITE_AGENT_GATEWAY_URL ??
    "wss://localhost:8081/connect",
};
