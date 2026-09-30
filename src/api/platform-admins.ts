import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";

// Platform admins (M1.W1 RBAC Phase A): membership in the Keycloak
// platform-admins group, managed via the Admin API server-side.
export type PlatformAdmin = components["schemas"]["PlatformAdminView"];
type ListPlatformAdminsOutputBody =
  components["schemas"]["ListPlatformAdminsOutputBody"];

export async function listPlatformAdmins(
  token: string | undefined,
): Promise<PlatformAdmin[]> {
  const res = await apiFetch<ListPlatformAdminsOutputBody>(`/platform/admins`, {
    token,
  });
  return res.admins ?? [];
}

export async function grantPlatformAdmin(
  token: string | undefined,
  subject: string,
): Promise<void> {
  await apiFetch<unknown>(
    `/platform/admins/${encodeURIComponent(subject)}`,
    { token, method: "PUT" },
  );
}

export async function revokePlatformAdmin(
  token: string | undefined,
  subject: string,
): Promise<void> {
  await apiFetch<unknown>(
    `/platform/admins/${encodeURIComponent(subject)}`,
    { token, method: "DELETE" },
  );
}
