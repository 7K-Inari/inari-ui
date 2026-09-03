import { apiFetch } from "@/api/client";

// Global permissions are computed server-side by the OpenFGA-backed
// authorization brain (M1.W2); the UI only consumes this projection.
export interface MyPermissions {
  canCreateOrganizations: boolean;
}

export async function fetchMyPermissions(
  token: string | undefined,
): Promise<MyPermissions> {
  const res = await apiFetch<{ canCreateOrganizations?: unknown }>(
    `/me/permissions`,
    { token },
  );
  return { canCreateOrganizations: res.canCreateOrganizations === true };
}
