export type ClusterStatus = "pending" | "connected" | "degraded" | "disconnected";

export type ManagementMode = "adopt" | "observe" | "ignore";

export interface ClusterSummary {
  id: string;
  name: string;
  tenant: string;
  status: ClusterStatus;
  k8sVersion: string | null;
  labels: Record<string, string>;
  capabilityCount: number;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface ClusterDetail extends ClusterSummary {
  description?: string;
  agentVersion: string | null;
}

export type CapabilityKind =
  | "crd"
  | "olm-csv"
  | "xrd"
  | "crossplane-provider"
  | "helm-release"
  | "kro-rgd";

export interface Capability {
  id: string;
  kind: CapabilityKind;
  name: string;
  group: string;
  version: string;
  managementMode: ManagementMode;
  updatedAt: string;
}

export interface CreateClusterRequest {
  name: string;
  description?: string;
  labels: Record<string, string>;
}

export interface CreateClusterResponse {
  cluster: ClusterDetail;
  registrationToken: string;
  tokenExpiresAt: string;
  install: {
    manifestYaml: string;
    helmCommand?: string;
  };
}
