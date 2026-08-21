import type {
  CatalogItem as SdkCatalogItem,
  Cluster as SdkCluster,
  ResourceInstance as SdkResourceInstance,
} from "@7k-inari/ui-plugin-sdk";

import type {
  CatalogItemSummary,
  ClusterSummary,
  ResourceInstanceSummary,
} from "@/api/types";

// Maps console API types onto the SDK host API types exposed to extensions.

const CLUSTER_STATE: Record<string, SdkCluster["state"]> = {
  pending: "Pending",
  connected: "Active",
  degraded: "Degraded",
  disconnected: "Degraded",
};

export function toSdkCluster(cluster: ClusterSummary): SdkCluster {
  return {
    id: cluster.id,
    name: cluster.name,
    tenantId: cluster.tenant,
    state: CLUSTER_STATE[cluster.status] ?? "Pending",
    kubernetesVersion: cluster.k8sVersion ?? undefined,
    labels: cluster.labels,
  };
}

export function toSdkCatalogItem(item: CatalogItemSummary): SdkCatalogItem {
  return {
    id: item.id,
    name: item.name,
    source: item.source,
    version: item.latestVersion,
    description: item.description,
  };
}

export function toSdkResourceInstance(
  instance: ResourceInstanceSummary,
): SdkResourceInstance {
  return {
    id: instance.id,
    catalogItemId: instance.catalogItemId,
    clusterId: instance.clusterId,
    name: instance.name,
    health: instance.health,
    ownerTeam: instance.ownerTeam,
  };
}
