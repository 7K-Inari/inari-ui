import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

export type VerificationPolicy = components["schemas"]["VerificationPolicy"];
export type VerificationView = components["schemas"]["VerificationView"];
export type VerificationPolicyPreview = components["schemas"]["PolicyPreview"];
export type VerificationRun = components["schemas"]["Run"];
export type VerificationRunOutput = components["schemas"]["RunOutputBody"];
export type VerificationRunList = components["schemas"]["RunListOutputBody"];

function instancePath(tenant: string, instanceId: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}/instances/${encodeURIComponent(instanceId)}`;
}

export function getInstanceVerification(token: string | undefined, tenant: string, instanceId: string) {
  return apiFetch<VerificationView>(`${instancePath(tenant, instanceId)}/verification`, { token });
}

export function previewInstanceVerification(token: string | undefined, tenant: string, instanceId: string, policy: VerificationPolicy) {
  return apiFetch<VerificationPolicyPreview>(`${instancePath(tenant, instanceId)}/verification/preview`, { token, method: "POST", body: policy });
}

export function saveInstanceVerification(token: string | undefined, tenant: string, instanceId: string, policy: VerificationPolicy) {
  return apiFetch<VerificationPolicy>(`${instancePath(tenant, instanceId)}/verification`, { token, method: "PUT", body: policy });
}

export function disableInstanceVerification(token: string | undefined, tenant: string, instanceId: string) {
  return apiFetch<VerificationPolicy>(`${instancePath(tenant, instanceId)}/verification`, { token, method: "DELETE" });
}

export function runInstanceVerification(token: string | undefined, tenant: string, instanceId: string, idempotencyKey: string, dryRun: boolean) {
  return apiFetch<VerificationRunOutput>(`${instancePath(tenant, instanceId)}/verification/runs`, {
    token, method: "POST", body: { idempotencyKey, dryRun },
  });
}

export function listInstanceVerificationRuns(token: string | undefined, tenant: string, instanceId: string, limit = 50) {
  return apiFetch<VerificationRunList>(`${instancePath(tenant, instanceId)}/verification/runs?limit=${limit}`, { token });
}

export function getInstanceVerificationRun(token: string | undefined, tenant: string, instanceId: string, runId: string) {
  return apiFetch<VerificationRun>(`${instancePath(tenant, instanceId)}/verification/runs/${encodeURIComponent(runId)}`, { token });
}
