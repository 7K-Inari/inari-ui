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
      features?: ConsoleFeatures;
    };
  }
}

// Feature flags. The dedicated flag system (task f368d08b, parked) will own
// evaluation later; until then these are static values that deployments can
// already override via window.__INARI_CONFIG__.features without UI changes.
export interface ConsoleFeatures {
  /** kubectl access (connect tab, kubeconfig download). Default on. */
  kubectlAccess?: boolean;
}

export interface ConsoleConfig {
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  apiBaseUrl: string;
  agentGatewayUrl: string;
  features: Required<ConsoleFeatures>;
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
  features: {
    kubectlAccess: window.__INARI_CONFIG__?.features?.kubectlAccess ?? true,
  },
};
