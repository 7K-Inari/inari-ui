import * as React from "react";

import { initKeycloak, keycloak, stopTokenRefresh } from "@/auth/keycloak";

export interface AuthState {
  initialized: boolean;
  authenticated: boolean;
  error: Error | null;
  token: string | undefined;
  parsedToken: Record<string, unknown> | undefined;
  login: () => void;
  logout: () => void;
  retry: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = React.useState(false);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [token, setToken] = React.useState<string | undefined>();
  const [parsedToken, setParsedToken] = React.useState<
    Record<string, unknown> | undefined
  >();
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    initKeycloak()
      .then((auth) => {
        if (cancelled) return;
        setError(null);
        setAuthenticated(auth);
        setToken(keycloak.token);
        setParsedToken(
          keycloak.tokenParsed as Record<string, unknown> | undefined,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to initialize authentication"),
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
      stopTokenRefresh();
    };
  }, [attempt]);

  const value: AuthState = {
    initialized,
    authenticated,
    error,
    token,
    parsedToken,
    login: () => keycloak.login(),
    logout: () => keycloak.logout(),
    retry: () => {
      setInitialized(false);
      setError(null);
      setAttempt((a) => a + 1);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
