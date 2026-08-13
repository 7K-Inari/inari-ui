export interface Organization {
  id: string;
  name: string;
}

type OrganizationClaimValue =
  | Record<string, unknown>
  | { name?: string }
  | undefined;

export function parseOrganizations(
  token: Record<string, unknown> | undefined,
): Organization[] {
  const claim = token?.["organization"];
  if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
    return [];
  }
  return Object.entries(claim as Record<string, OrganizationClaimValue>).map(
    ([id, value]) => {
      const name =
        value && typeof value === "object" && "name" in value
          ? String((value as { name?: unknown }).name ?? id)
          : id;
      return { id, name };
    },
  );
}
