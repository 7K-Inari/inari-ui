import { createContext, createElement, useContext, type ReactNode } from 'react';

export interface TenantRef {
  orgId: string;
  orgName: string;
  team?: string;
}

export interface TenantChangeEvent {
  previous: TenantRef | null;
  current: TenantRef;
}

export type TenantChangeListener = (event: TenantChangeEvent) => void;

export interface TenantState {
  current: TenantRef | null;
  available: TenantRef[];
  switchTenant: (orgId: string, team?: string) => void;
  onTenantChange: (listener: TenantChangeListener) => () => void;
}

export const TenantContext = createContext<TenantState | null>(null);

export function TenantProvider(props: { value: TenantState; children: ReactNode }) {
  return createElement(TenantContext.Provider, { value: props.value }, props.children);
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}

export function createTenantState(available: TenantRef[]): TenantState & { _listeners: Set<TenantChangeListener> } {
  const listeners = new Set<TenantChangeListener>();
  const state = {
    current: available[0] ?? null,
    available,
    _listeners: listeners,
    switchTenant(orgId: string, team?: string) {
      const next = available.find((t) => t.orgId === orgId && (team === undefined || t.team === team));
      if (!next) throw new Error(`unknown tenant: ${orgId}${team ? `/${team}` : ''}`);
      const previous = state.current;
      state.current = next;
      listeners.forEach((l) => l({ previous, current: next }));
    },
    onTenantChange(listener: TenantChangeListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return state;
}
