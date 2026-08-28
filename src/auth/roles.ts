export const PLATFORM_ADMIN_ROLE = "platform-admin";

export function hasRealmRole(
  token: Record<string, unknown> | undefined,
  role: string,
): boolean {
  const realmAccess = token?.["realm_access"];
  if (!realmAccess || typeof realmAccess !== "object") return false;
  const roles = (realmAccess as { roles?: unknown }).roles;
  return Array.isArray(roles) && roles.includes(role);
}

export function canCreateOrganizations(
  token: Record<string, unknown> | undefined,
): boolean {
  return hasRealmRole(token, PLATFORM_ADMIN_ROLE);
}
