// The per-cluster kubectl-proxy setting is writable with the same relation
// the server enforces on PATCH (platform engineer). Unknown roles are
// treated as "unknown", never as denial — the API error is the fallback
// signal.
export function canManageKubectlProxy(
  orgRoles: Record<string, string> | undefined,
  tenant: string,
): boolean {
  const role = orgRoles?.[tenant];
  if (role === undefined) return true;
  return role === "org-admin" || role === "platform-engineer";
}
