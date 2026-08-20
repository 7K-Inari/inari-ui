import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Fleet management (§5.11, screen 11): ClusterSets, staged rollouts with
// health + approval gates, drift (report-only in v1), agent upgrade channels.

export interface ClusterSet {
  id: string;
  name: string;
  tenant: string;
  labels: Record<string, string>;
  memberClusterIds: string[];
  createdAt: string;
}

export type RolloutClusterState = "pending" | "deploying" | "healthy" | "failed";

export interface RolloutClusterStatus {
  clusterId: string;
  clusterName: string;
  state: RolloutClusterState;
  message: string | null;
}

export type GateState = "closed" | "open" | "approved" | "rejected";

export interface RolloutStage {
  name: string;
  kind: "canary" | "wave";
  clusters: RolloutClusterStatus[];
  gate: { type: "auto" | "approval"; state: GateState };
}

export type RolloutState =
  | "running"
  | "waiting-approval"
  | "completed"
  | "failed"
  | "rolled-back";

export interface Rollout {
  id: string;
  name: string;
  tenant: string;
  target: {
    kind: "capability" | "policy-pack" | "agent";
    name: string;
    version: string;
  };
  clusterSetId: string;
  clusterSetName: string;
  state: RolloutState;
  stages: RolloutStage[];
  createdAt: string;
}

export interface DriftEntry {
  id: string;
  clusterId: string;
  clusterName: string;
  resourceKind: string;
  name: string;
  namespace: string;
  field: string;
  desired: string;
  reported: string;
  detectedAt: string;
}

export type AgentChannel = "stable" | "canary";

export interface AgentChannelAssignment {
  clusterSetId: string;
  clusterSetName: string;
  channel: AgentChannel;
  currentVersion: string;
  latestVersion: string;
  // N/N−1 compatibility window (§7.1): the oldest agent version the control
  // plane still supports for this channel.
  minSupportedVersion: string;
}

function base(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function listClusterSets(
  token: string | undefined,
  tenant: string,
): Promise<ClusterSet[]> {
  const res = await apiFetch<{ clusterSets: ClusterSet[] }>(`${base(tenant)}/clustersets`, {
    token,
  });
  return res.clusterSets;
}

export async function getClusterSet(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<ClusterSet> {
  const res = await apiFetch<{ clusterSet: ClusterSet }>(
    `${base(tenant)}/clustersets/${encodeURIComponent(id)}`,
    { token },
  );
  return res.clusterSet;
}

export async function createClusterSet(
  token: string | undefined,
  tenant: string,
  input: { name: string; labels: Record<string, string> },
): Promise<ClusterSet> {
  const res = await apiFetch<{ clusterSet: ClusterSet }>(`${base(tenant)}/clustersets`, {
    token,
    method: "POST",
    body: input,
  });
  return res.clusterSet;
}

export async function deleteClusterSet(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<void> {
  await apiFetch(`${base(tenant)}/clustersets/${encodeURIComponent(id)}`, {
    token,
    method: "DELETE",
  });
}

export async function listRollouts(
  token: string | undefined,
  tenant: string,
): Promise<Rollout[]> {
  const res = await apiFetch<{ rollouts: Rollout[] }>(`${base(tenant)}/fleet/rollouts`, {
    token,
  });
  return res.rollouts;
}

export async function getRollout(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<Rollout> {
  const res = await apiFetch<{ rollout: Rollout }>(
    `${base(tenant)}/fleet/rollouts/${encodeURIComponent(id)}`,
    { token },
  );
  return res.rollout;
}

export async function decideRolloutGate(
  token: string | undefined,
  tenant: string,
  rolloutId: string,
  stageName: string,
  decision: "approve" | "reject",
): Promise<Rollout> {
  const res = await apiFetch<{ rollout: Rollout }>(
    `${base(tenant)}/fleet/rollouts/${encodeURIComponent(rolloutId)}/gates/${encodeURIComponent(stageName)}/${decision}`,
    { token, method: "POST" },
  );
  return res.rollout;
}

export async function rollbackRollout(
  token: string | undefined,
  tenant: string,
  rolloutId: string,
): Promise<Rollout> {
  const res = await apiFetch<{ rollout: Rollout }>(
    `${base(tenant)}/fleet/rollouts/${encodeURIComponent(rolloutId)}/rollback`,
    { token, method: "POST" },
  );
  return res.rollout;
}

export async function listDrift(
  token: string | undefined,
  tenant: string,
): Promise<DriftEntry[]> {
  const res = await apiFetch<{ drift: DriftEntry[] }>(`${base(tenant)}/fleet/drift`, {
    token,
  });
  return res.drift;
}

export async function listAgentChannels(
  token: string | undefined,
  tenant: string,
): Promise<AgentChannelAssignment[]> {
  const res = await apiFetch<{ channels: AgentChannelAssignment[] }>(
    `${base(tenant)}/fleet/agent-channels`,
    { token },
  );
  return res.channels;
}

export async function setAgentChannel(
  token: string | undefined,
  tenant: string,
  clusterSetId: string,
  channel: AgentChannel,
): Promise<AgentChannelAssignment> {
  const res = await apiFetch<{ channel: AgentChannelAssignment }>(
    `${base(tenant)}/fleet/agent-channels/${encodeURIComponent(clusterSetId)}`,
    { token, method: "PUT", body: { channel } },
  );
  return res.channel;
}
