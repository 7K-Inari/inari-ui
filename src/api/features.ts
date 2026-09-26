import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";

// Global, server-driven feature flags (GET /api/v1/features). The console
// hides surfaces the control plane has disabled — e.g. the kubectl-proxy
// e2e-access flow under INARI_DISABLE_KUBECTL_PROXY.
export type Features = components["schemas"]["FeaturesOutputBody"];

export async function getFeatures(token: string | undefined): Promise<Features> {
  return apiFetch<Features>("/features", { token });
}
