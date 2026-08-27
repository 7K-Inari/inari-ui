export interface Organization {
  id: string;
  name: string;
}

type OrganizationClaimValue =
  | Record<string, unknown>
  | { name?: unknown }
  | undefined;

export function parseOrganizations(
  token: Record<string, unknown> | undefined,
): Organization[] {
  const claim = token?.["organization"];
  if (!claim || typeof claim !== "object") {
    return [];
  }
  const orgs = Array.isArray(claim)
    ? claim
        .filter((alias): alias is string => typeof alias === "string")
        .map((alias) => ({ id: alias, name: alias }))
    : Object.entries(claim as Record<string, OrganizationClaimValue>).map(
        ([id, value]) => {
          const rawName =
            value && typeof value === "object" && "name" in value
              ? (value as { name?: unknown }).name
              : undefined;
          const name = typeof rawName === "string" ? rawName : id;
          return { id, name };
        },
      );
  const seen = new Set<string>();
  return orgs.filter((org) => {
    if (seen.has(org.id)) return false;
    seen.add(org.id);
    return true;
  });
}

export function hasOrganization(
  token: Record<string, unknown> | undefined,
  alias: string,
): boolean {
  return parseOrganizations(token).some((org) => org.id === alias);
}
