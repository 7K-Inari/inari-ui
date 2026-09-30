import type { KeycloakGroup } from "@/api/rbac";

function prettify(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// "platform-team" → "Platform Team". The team slug (not the raw
// tenant-<slug>/<team> group path) is the display source. Role display names
// come from the role entities themselves (GET /roles, ADR-0013) — no
// client-side role catalog remains.
export function teamDisplayName(group: KeycloakGroup): string {
  return prettify(group.team || group.path.split("/").pop() || group.path);
}
