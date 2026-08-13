import { ALL_TENANTS } from "@/tenant/tenant-link";

export interface TenantScoped {
  tenant: string;
}

export function scopeToTenant<T extends TenantScoped>(
  items: T[],
  tenant: string,
): T[] {
  if (tenant === ALL_TENANTS) return items;
  const scoped = items.filter((item) => item.tenant === tenant);
  if (import.meta.env.DEV && scoped.length !== items.length) {
    const foreign = items.filter((item) => item.tenant !== tenant);
    if (foreign.length > 0) {
      console.warn(
        `[tenant-scope] filtered ${foreign.length} resource(s) not belonging to tenant "${tenant}"`,
      );
    }
  }
  return scoped;
}

export function assertTenantScope(resource: TenantScoped, tenant: string): void {
  if (tenant !== ALL_TENANTS && resource.tenant !== tenant) {
    throw new Error(
      `Cross-tenant access blocked: resource belongs to "${resource.tenant}", active scope is "${tenant}"`,
    );
  }
}
