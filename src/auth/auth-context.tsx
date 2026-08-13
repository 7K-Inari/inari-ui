import * as React from "react";

import { initKeycloak, keycloak } from "@/auth/keycloak";

export interface AuthState {
  initialized: boolean;
  authenticated: boolean;
  token: string | undefined;
  parsedToken: Record<string, unknown> | undefined;
  login: () => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = React.useState(false);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [token, setToken] = React.useState<string | undefined>();
  const [parsedToken, setParsedToken] = React.useState<
    Record<string, unknown> | undefined
  >();

  React.useEffect(() => {
    let cancelled = false;
    initKeycloak()
      .then((auth) => {
        if (cancelled) return;
        setAuthenticated(auth);
        setToken(keycloak.token);
        setParsedToken(
          keycloak.tokenParsed as Record<string, unknown> | undefined,
        );
      })
      .finally(() => {
        if (!cancelled) setInitialized(true);
      });
    keycloak.onAuthRefreshSuccess = () => {
      setToken(keycloak.token);
      setParsedToken(keycloak.tokenParsed as Record<string, unknown>);
    };
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthState = {
    initialized,
    authenticated,
    token,
    parsedToken,
    login: () => keycloak.login(),
    logout: () => keycloak.logout(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
