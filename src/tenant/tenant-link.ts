export const ALL_TENANTS = "all";

export function tenantLink(tenant: string, path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `/${tenant}/${clean}`;
}

export function isValidTenant(tenant: string, orgIds: string[]): boolean {
  return tenant === ALL_TENANTS || orgIds.includes(tenant);
}
