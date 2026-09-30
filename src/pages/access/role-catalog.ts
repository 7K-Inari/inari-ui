// Client-side friendly catalog for the tenant ClusterRoles surfaced by
// GET /tenants/{org}/rbac (M1.W1 Phase A). Raw names like
// `tenant-<slug>-operator` must never be primary UX; Phase B replaces this
// static catalog with server-side role entities.
import type { KeycloakGroup, TenantClusterRole } from "@/api/rbac";

export interface RoleCatalogEntry {
  name: string;
  description: string;
}

const KIND_CATALOG: Record<string, RoleCatalogEntry> = {
  operator: {
    name: "Operator",
    description: "Full manage rights on tenant-scoped namespaces and resources.",
  },
  viewer: {
    name: "Viewer",
    description: "Read-only access to tenant namespaces and resources.",
  },
};

function prettify(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function roleDisplay(role: TenantClusterRole): RoleCatalogEntry {
  const entry = KIND_CATALOG[role.kind];
  if (entry) {
    return { name: entry.name, description: role.description || entry.description };
  }
  // Fallback: prettify the role name suffix (tenant-<slug>-operator → Operator).
  const suffix = role.name.split("-").pop() ?? role.name;
  return { name: prettify(suffix), description: role.description };
}

// "platform-team" → "Platform Team". The team slug (not the raw
// tenant-<slug>/<team> group path) is the display source.
export function teamDisplayName(group: KeycloakGroup): string {
  return prettify(group.team || group.path.split("/").pop() || group.path);
}
