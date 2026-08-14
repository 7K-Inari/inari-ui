import { apiFetch } from "@/api/client";
import type {
  Capability,
  ClusterDetail,
  ClusterSummary,
  CreateClusterRequest,
  CreateClusterResponse,
} from "@/api/types";
import { ALL_TENANTS } from "@/tenant/tenant-link";

function tenantQuery(tenant: string): string {
  return tenant === ALL_TENANTS ? "" : `?tenant=${encodeURIComponent(tenant)}`;
}

export function listClusters(token: string | undefined, tenant: string) {
  return apiFetch<ClusterSummary[]>(`/clusters${tenantQuery(tenant)}`, { token });
}

export function getCluster(token: string | undefined, id: string) {
  return apiFetch<ClusterDetail>(`/clusters/${encodeURIComponent(id)}`, { token });
}

export function getCapabilities(token: string | undefined, id: string) {
  return apiFetch<Capability[]>(`/clusters/${encodeURIComponent(id)}/capabilities`, { token });
}

export function createCluster(
  token: string | undefined,
  tenant: string,
  body: CreateClusterRequest,
) {
  return apiFetch<CreateClusterResponse>(`/clusters${tenantQuery(tenant)}`, {
    token,
    method: "POST",
    body,
  });
}

export function getInstallManifest(token: string | undefined, id: string) {
  return apiFetch<string>(`/clusters/${encodeURIComponent(id)}/install-manifest`, { token });
}
