import type { AuthState, Principal } from '../host/auth';
import { createTenantState, type TenantRef, type TenantState } from '../host/tenant';
import { ApiClient, type ApiClientOptions } from '../host/api';
import type { SlotContext } from '../blueprints/types';

export function mockPrincipal(overrides: Partial<Principal> = {}): Principal {
  return {
    subject: 'user:dev',
    displayName: 'Dev User',
    groups: ['tenant-acme/platform-team'],
    ...overrides,
  };
}

export function mockAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    principal: mockPrincipal(),
    getToken: () => 'mock-token',
    ...overrides,
  };
}

export function mockTenantState(tenants?: TenantRef[]): TenantState {
  return createTenantState(
    tenants ?? [
      { orgId: 'org:acme', orgName: 'Acme', team: 'platform-team' },
      { orgId: 'org:globex', orgName: 'Globex' },
    ],
  );
}

export function mockApiClient(overrides: Partial<ApiClientOptions> = {}): ApiClient {
  return new ApiClient({
    baseUrl: 'http://mock-control-plane',
    getToken: () => 'mock-token',
    fetchImpl: async () => new Response('[]', { status: 200 }),
    ...overrides,
  });
}

export function mockSlotContext(overrides: Partial<SlotContext> = {}): SlotContext {
  return {
    auth: mockAuthState(),
    tenant: mockTenantState(),
    ...overrides,
  };
}
