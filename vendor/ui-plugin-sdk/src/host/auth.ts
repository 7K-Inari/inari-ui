import { createContext, createElement, useContext, type ReactNode } from 'react';

export interface Principal {
  subject: string;
  displayName: string;
  groups: string[];
}

export interface AuthState {
  principal: Principal | null;
  getToken: () => Promise<string | undefined> | string | undefined;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider(props: { value: AuthState; children: ReactNode }) {
  return createElement(AuthContext.Provider, { value: props.value }, props.children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function usePrincipal(): Principal | null {
  return useAuth().principal;
}
