import { apiFetch } from "@/api/client";

// TODO(contract-sync): the platform admins routes (M1.W1 RBAC Phase A server
// task — GET/PUT/DELETE /api/v1/platform/admins[/{subject}]) are not yet in
// the pinned OpenAPI snapshot; the shapes below follow the architecture plan.
// Replace these local interfaces with generated schemas at the codegen tail
// (npm run sync:api).
export interface PlatformAdmin {
  subject: string;
  email?: string;
  displayName?: string;
}

export async function listPlatformAdmins(
  token: string | undefined,
): Promise<PlatformAdmin[]> {
  const res = await apiFetch<{ admins?: PlatformAdmin[] }>(`/platform/admins`, {
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
