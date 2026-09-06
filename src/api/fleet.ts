import { apiFetch } from "@/api/client";
import type { components } from "@/api/__generated__/schema";
import { resolveTenant } from "@/tenant/current";

// Fleet management (§5.11, screen 11): ClusterSets, staged rollouts with
// health + approval gates, drift (report-only in v1), agent upgrade channels.
// Server shapes come from the huma-generated OpenAPI contract (pinned
// snapshot in openapi/openapi.yaml) — never hand-write server shapes; the
// exported interfaces below are UI view models consumed by pages and mocks.

export interface ClusterSet {
  id: string;
  name: string;
  tenant: string;
  labels: Record<string, string>; // the ClusterSet labelSelector
  createdAt: string;
}

// A cluster that currently matches a ClusterSet's labelSelector
// (GET /cluster-sets/{id}/members resolves these server-side).
export interface ClusterSetMember {
  id: string;
  name: string;
  state: string;
}

// Stage gate configuration from the rollout definition (before/afterGate).
// Gate *decisions* are not exposed by the API — there is no gate-decision
// endpoint; a rollout blocked on an approval shows state "waiting_approval".
export interface RolloutStageGate {
  type: string;
  waitSeconds?: number;
  when: "before" | "after";
}

export interface RolloutStage {
  name: string;
  clusterSetIds: string[];
  maxConcurrency: string;
  gates: RolloutStageGate[];
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
    kind: "capability" | "policy-pack" | "agent" | "catalog-version";
    name: string;
    version: string;
  };
  state: RolloutState;
  stages: RolloutStage[];
  currentStage: number;
  createdAt: string;
}

// Per-cluster rollout status, keyed by stage index (RolloutTarget payload).
export interface RolloutTarget {
  clusterId: string;
  stage: number;
  status: string;
  observedHealth?: string;
  updatedAt: string;
}

export interface DriftEntry {
  id: string;
  clusterId: string;
  kind: string;
  resourceRef?: string;
  desiredHash?: string;
  reportedHash?: string;
  detail?: string;
  detectedAt: string;
}

export type AgentChannel = "stable" | "canary";

export interface AgentChannelAssignment {
  clusterSetId: string;
  channel: AgentChannel;
  desiredAgentVersion: string;
}

type ServerCluster = components["schemas"]["Cluster"];
type ServerClusterSet = components["schemas"]["ClusterSet"];
type ServerRollout = components["schemas"]["Rollout"];
type ServerRolloutStage = components["schemas"]["RolloutStage"];
type ServerRolloutTarget = components["schemas"]["RolloutTarget"];
type ServerDriftEvent = components["schemas"]["DriftEvent"];
type ServerAgentChannel = components["schemas"]["AgentChannel"];
type ListClusterSetsResponse = components["schemas"]["ListClusterSetsOutputBody"];
type ClusterSetResponse = components["schemas"]["ClusterSetOutputBody"];
type MembersResponse = components["schemas"]["MembersOutputBody"];
type ListRolloutsResponse = components["schemas"]["ListRolloutsOutputBody"];
type RolloutResponse = components["schemas"]["RolloutOutputBody"];
type TargetsResponse = components["schemas"]["TargetsOutputBody"];
type ListDriftResponse = components["schemas"]["ListDriftOutputBody"];
type ListChannelsResponse = components["schemas"]["ListChannelsOutputBody"];
type ChannelResponse = components["schemas"]["ChannelOutputBody"];

function mapClusterSet(c: ServerClusterSet): ClusterSet {
  return {
    id: c.id,
    name: c.name,
    tenant: c.orgId,
    labels: c.labelSelector,
    createdAt: c.createdAt,
  };
}

function mapClusterSetMember(c: ServerCluster): ClusterSetMember {
  return {
    id: c.id,
    name: c.name,
    state: c.state,
  };
}

function mapTargetKind(kind: string): Rollout["target"]["kind"] {
  if (kind === "policy_pack") return "policy-pack";
  if (kind === "agent_upgrade") return "agent";
  if (kind === "catalog_version") return "catalog-version";
  return "capability";
}

function mapRolloutState(state: string): RolloutState {
  if (state === "waiting_approval") return "waiting-approval";
  if (state === "rolled_back") return "rolled-back";
  return state as RolloutState;
}

function mapStage(stage: ServerRolloutStage): RolloutStage {
  const gates: RolloutStageGate[] = [];
  if (stage.beforeGate) {
    gates.push({
      type: stage.beforeGate.type,
      waitSeconds: stage.beforeGate.waitSeconds,
      when: "before",
    });
  }
  if (stage.afterGate) {
    gates.push({
      type: stage.afterGate.type,
      waitSeconds: stage.afterGate.waitSeconds,
      when: "after",
    });
  }
  return {
    name: stage.name,
    clusterSetIds: stage.clusterSetIds ?? [],
    maxConcurrency: stage.maxConcurrency,
    gates,
  };
}

function mapRollout(r: ServerRollout): Rollout {
  return {
    id: r.id,
    name: r.name,
    tenant: r.orgId,
    target: {
      kind: mapTargetKind(r.kind),
      name: r.targetRef,
      version: r.desiredVersion,
    },
    state: mapRolloutState(r.state),
    stages: (r.stages ?? []).map(mapStage),
    currentStage: r.currentStage,
    createdAt: r.createdAt,
  };
}

function mapRolloutTarget(t: ServerRolloutTarget): RolloutTarget {
  return {
    clusterId: t.clusterId,
    stage: t.stage,
    status: t.status,
    observedHealth: t.observedHealth,
    updatedAt: t.updatedAt,
  };
}

function mapDriftEvent(d: ServerDriftEvent): DriftEntry {
  return {
    id: d.id,
    clusterId: d.clusterId,
    kind: d.kind,
    resourceRef: d.resourceRef,
    desiredHash: d.desiredHash,
    reportedHash: d.reportedHash,
    detail: d.detail,
    detectedAt: d.detectedAt,
  };
}

function mapAgentChannel(c: ServerAgentChannel): AgentChannelAssignment {
  return {
    clusterSetId: c.clusterSetId,
    channel: c.channel as AgentChannel,
    desiredAgentVersion: c.desiredAgentVersion,
  };
}

function base(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}`;
}

export async function listClusterSets(
  token: string | undefined,
  tenant: string,
): Promise<ClusterSet[]> {
  const res = await apiFetch<ListClusterSetsResponse>(`${base(tenant)}/cluster-sets`, {
    token,
  });
  return (res.clusterSets ?? []).map(mapClusterSet);
}

export async function getClusterSet(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<ClusterSet> {
  const res = await apiFetch<ClusterSetResponse>(
    `${base(tenant)}/cluster-sets/${encodeURIComponent(id)}`,
    { token },
  );
  return mapClusterSet(res.clusterSet);
}

export async function createClusterSet(
  token: string | undefined,
  tenant: string,
  input: { name: string; labels: Record<string, string> },
): Promise<ClusterSet> {
  const res = await apiFetch<ClusterSetResponse>(`${base(tenant)}/cluster-sets`, {
    token,
    method: "POST",
    // Wire body speaks labelSelector, not "labels".
    body: { name: input.name, labelSelector: input.labels },
  });
  return mapClusterSet(res.clusterSet);
}

export async function deleteClusterSet(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<void> {
  await apiFetch(`${base(tenant)}/cluster-sets/${encodeURIComponent(id)}`, {
    token,
    method: "DELETE",
  });
}

// Members are resolved server-side from the ClusterSet labelSelector.
export async function listClusterSetMembers(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<ClusterSetMember[]> {
  const res = await apiFetch<MembersResponse>(
    `${base(tenant)}/cluster-sets/${encodeURIComponent(id)}/members`,
    { token },
  );
  return (res.clusters ?? []).map(mapClusterSetMember);
}

export async function listRollouts(
  token: string | undefined,
  tenant: string,
): Promise<Rollout[]> {
  const res = await apiFetch<ListRolloutsResponse>(`${base(tenant)}/rollouts`, {
    token,
  });
  return (res.rollouts ?? []).map(mapRollout);
}

export async function getRollout(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<Rollout> {
  const res = await apiFetch<RolloutResponse>(
    `${base(tenant)}/rollouts/${encodeURIComponent(id)}`,
    { token },
  );
  return mapRollout(res.rollout);
}

// Per-cluster stage progress comes from the targets payload, not the rollout.
export async function listRolloutTargets(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<RolloutTarget[]> {
  const res = await apiFetch<TargetsResponse>(
    `${base(tenant)}/rollouts/${encodeURIComponent(id)}/targets`,
    { token },
  );
  return (res.targets ?? []).map(mapRolloutTarget);
}

export async function rollbackRollout(
  token: string | undefined,
  tenant: string,
  rolloutId: string,
): Promise<Rollout> {
  const res = await apiFetch<RolloutResponse>(
    `${base(tenant)}/rollouts/${encodeURIComponent(rolloutId)}/rollback`,
    { token, method: "POST" },
  );
  return mapRollout(res.rollout);
}

export async function listDrift(
  token: string | undefined,
  tenant: string,
): Promise<DriftEntry[]> {
  const res = await apiFetch<ListDriftResponse>(`${base(tenant)}/drift`, {
    token,
  });
  return (res.driftEvents ?? []).map(mapDriftEvent);
}

export async function listAgentChannels(
  token: string | undefined,
  tenant: string,
): Promise<AgentChannelAssignment[]> {
  const res = await apiFetch<ListChannelsResponse>(`${base(tenant)}/agent-channels`, {
    token,
  });
  return (res.channels ?? []).map(mapAgentChannel);
}

export async function setAgentChannel(
  token: string | undefined,
  tenant: string,
  clusterSetId: string,
  channel: AgentChannel,
  desiredAgentVersion: string,
): Promise<AgentChannelAssignment> {
  const res = await apiFetch<ChannelResponse>(
    `${base(tenant)}/cluster-sets/${encodeURIComponent(clusterSetId)}/channels/${encodeURIComponent(channel)}`,
    { token, method: "PUT", body: { desiredAgentVersion } },
  );
  return mapAgentChannel(res.channel);
}
