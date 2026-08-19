import { ALL_TENANTS } from "@/tenant/tenant-link";

// Module-level mirror of the active tenant context, so API helpers that are
// called without an explicit tenant (e.g. detail pages) can still build
// tenant-scoped server paths. TenantProvider keeps it in sync.
let currentTenant: string = ALL_TENANTS;

export function setCurrentTenant(tenant: string): void {
  currentTenant = tenant;
}

export function getCurrentTenant(): string {
  return currentTenant;
}

// resolveTenant returns the explicit tenant or the active one. The server
// has no cross-tenant endpoints, so "All tenants" is not a valid API scope.
export function resolveTenant(explicit?: string): string {
  const t = explicit ?? currentTenant;
  if (!t || t === ALL_TENANTS) {
    throw new Error("Select a specific tenant to load this view");
  }
  return t;
}
