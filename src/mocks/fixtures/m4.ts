import type { components } from "@/api/__generated__/schema";
import type { BackendExtension, UiExtensionRemote } from "@/api/extensions";
import type { AgentChannel } from "@/api/fleet";
import type {
  CreateScaffoldRequest,
  ScaffoldOutputs,
  ScaffoldPhase,
  ScaffoldRun,
  TemplateDetail,
} from "@/api/templates";
import { argocdBackendExtension, argocdRemote } from "@/mocks/fixtures/extensions";

// M4 fixtures: extension registry, templates/scaffolds, fleet (ClusterSets,
// rollouts + targets, drift, agent channels). Fleet fixtures speak the huma
// wire shapes directly (src/api/fleet.ts mappers are the source of truth).
// Poll-based mocks advance on each read, mirroring createDeployMock/pollDeployMock.

type ServerCluster = components["schemas"]["Cluster"];
type ServerClusterSet = components["schemas"]["ClusterSet"];
type ServerRollout = components["schemas"]["Rollout"];
type ServerRolloutTarget = components["schemas"]["RolloutTarget"];
type ServerDriftEvent = components["schemas"]["DriftEvent"];
type ServerAgentChannel = components["schemas"]["AgentChannel"];

interface M4State {
  uiExtensions: UiExtensionRemote[];
  backendExtensions: BackendExtension[];
  scaffoldRuns: ScaffoldState[];
  clusterSets: ServerClusterSet[];
  rollouts: RolloutStateInternal[];
  drift: ServerDriftEvent[];
  agentChannels: ServerAgentChannel[];
}

function seedState(): M4State {
  return {
    uiExtensions: [{ ...argocdRemote }],
    backendExtensions: [{ ...argocdBackendExtension }],
    scaffoldRuns: [],
    clusterSets: [
      {
        id: "cs-canary",
        orgId: "acme",
        name: "canary",
        labelSelector: { wave: "canary" },
        createdAt: new Date(Date.now() - 40 * 86400_000).toISOString(),
      },
      {
        id: "cs-prod-eu",
        orgId: "acme",
        name: "prod-eu",
        labelSelector: { region: "eu", env: "prod" },
        createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
      },
    ],
    rollouts: [seedRollout()],
    drift: [
      {
        id: "drift-1",
        orgId: "acme",
        clusterId: "c-eu-1",
        kind: "Deployment",
        resourceRef: "payments-api",
        desiredHash: "sha256:3fa1desired",
        reportedHash: "sha256:9bcdreported",
        detail: "replica count differs from the desired state",
        status: "open",
        detectedAt: new Date(Date.now() - 7200_000).toISOString(),
      },
      {
        id: "drift-2",
        orgId: "acme",
        clusterId: "c-edge-1",
        kind: "ConfigMap",
        resourceRef: "ingress-config",
        desiredHash: "sha256:51abdesired",
        reportedHash: "sha256:77efreported",
        detail: "log level override applied out of band",
        status: "open",
        detectedAt: new Date(Date.now() - 1800_000).toISOString(),
      },
      {
        id: "drift-3",
        orgId: "acme",
        clusterId: "c-eu-1",
        kind: "StatefulSet",
        resourceRef: "redis-cache",
        desiredHash: "sha256:aa10desired",
        reportedHash: "sha256:aa10reported",
        detail: "resolved by agent resync",
        status: "resolved",
        detectedAt: new Date(Date.now() - 86400_000).toISOString(),
      },
    ],
    agentChannels: [
      {
        id: "ch-canary",
        orgId: "acme",
        clusterSetId: "cs-canary",
        channel: "canary",
        desiredAgentVersion: "1.9.0-rc.2",
        createdAt: new Date(Date.now() - 40 * 86400_000).toISOString(),
        updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
      {
        id: "ch-prod-eu",
        orgId: "acme",
        clusterSetId: "cs-prod-eu",
        channel: "stable",
        desiredAgentVersion: "1.8.3",
        createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
        updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ],
  };
}

let state: M4State = seedState();

export const m4MockControl = {
  reset() {
    state = seedState();
  },
};

export function listUiExtensionMocks(): UiExtensionRemote[] {
  return state.uiExtensions.map((e) => ({ ...e }));
}

export function addUiExtensionMock(input: {
  name: string;
  remoteEntryUrl: string;
}): UiExtensionRemote {
  const remote: UiExtensionRemote = {
    name: input.name,
    version: "0.0.0",
    remoteEntryUrl: input.remoteEntryUrl,
    slots: [],
    enabled: true,
  };
  state.uiExtensions.push(remote);
  return { ...remote };
}

export function removeUiExtensionMock(name: string): boolean {
  const idx = state.uiExtensions.findIndex((e) => e.name === name);
  if (idx < 0) return false;
  state.uiExtensions.splice(idx, 1);
  return true;
}

export function listBackendExtensionMocks(): BackendExtension[] {
  return state.backendExtensions.map((e) => ({ ...e }));
}

export const selfExtensionPermissions = [
  "extensions:invoke:inari-ext-argocd",
  "extensions:invoke:*",
];

/* ---- templates / scaffolds ---- */

const templates: TemplateDetail[] = [
  {
    id: "web-service",
    name: "web-service",
    displayName: "Web Service",
    description:
      "Golden-path web service: repo, CI pipeline, catalog entry, and tenant RBAC in one flow.",
    tags: ["golden-path", "service"],
    version: "1.4.0",
    schema: {
      type: "object",
      required: ["description", "port"],
      properties: {
        description: { type: "string", title: "Description" },
        port: { type: "number", title: "Port", minimum: 1, maximum: 65535 },
        team: { type: "string", title: "Owning team" },
      },
    },
  },
];

export function listTemplateMocks(): TemplateDetail[] {
  return templates.map((t) => ({ ...t }));
}

export function findTemplateMock(id: string): TemplateDetail | undefined {
  const t = templates.find((tpl) => tpl.id === id);
  return t ? { ...t } : undefined;
}

const SCAFFOLD_PHASES: ScaffoldPhase[] = [
  "pending",
  "rendering",
  "creating-repo",
  "creating-pipeline",
  "registering-catalog",
  "binding-rbac",
  "completed",
];

interface ScaffoldState extends ScaffoldRun {
  polls: number;
}

function scaffoldOutputs(run: ScaffoldState): ScaffoldOutputs {
  return {
    repoUrl:
      SCAFFOLD_PHASES.indexOf(run.phase) >= SCAFFOLD_PHASES.indexOf("creating-pipeline")
        ? `https://github.com/acme/${run.name}`
        : null,
    pipelineUrl:
      SCAFFOLD_PHASES.indexOf(run.phase) >= SCAFFOLD_PHASES.indexOf("registering-catalog")
        ? `https://github.com/acme/${run.name}/actions`
        : null,
    catalogItemId:
      run.phase === "completed" || run.phase === "binding-rbac"
        ? `discovered-${run.name}`
        : null,
  };
}

export function createScaffoldMock(tenant: string, body: CreateScaffoldRequest): ScaffoldRun {
  const template = findTemplateMock(body.templateId);
  const run: ScaffoldState = {
    id: `scaf-${Math.random().toString(36).slice(2, 10)}`,
    templateId: body.templateId,
    templateName: template?.displayName ?? body.templateId,
    name: body.name,
    tenant,
    phase: "pending",
    message: null,
    outputs: { repoUrl: null, pipelineUrl: null, catalogItemId: null },
    createdAt: new Date().toISOString(),
    polls: 0,
  };
  state.scaffoldRuns.push(run);
  const rest = { ...run } as Partial<ScaffoldState>;
  delete rest.polls;
  return rest as ScaffoldRun;
}

export function pollScaffoldMock(id: string): ScaffoldRun | undefined {
  const run = state.scaffoldRuns.find((r) => r.id === id);
  if (!run) return undefined;
  run.polls += 1;
  run.phase = SCAFFOLD_PHASES[Math.min(run.polls, SCAFFOLD_PHASES.length - 1)];
  run.outputs = scaffoldOutputs(run);
  const rest = { ...run } as Partial<ScaffoldState>;
  delete rest.polls;
  return rest as ScaffoldRun;
}

/* ---- fleet: ClusterSets ---- */

export function listClusterSetMocks(tenant: string): ServerClusterSet[] {
  return state.clusterSets.filter((s) => s.orgId === tenant).map((s) => ({ ...s }));
}

export function getClusterSetMock(id: string): ServerClusterSet | undefined {
  const set = state.clusterSets.find((s) => s.id === id);
  return set ? { ...set } : undefined;
}

export function createClusterSetMock(
  tenant: string,
  input: { name: string; labelSelector: Record<string, string> },
): ServerClusterSet {
  const set: ServerClusterSet = {
    id: `cs-${input.name}`,
    orgId: tenant,
    name: input.name,
    labelSelector: input.labelSelector,
    createdAt: new Date().toISOString(),
  };
  state.clusterSets.push(set);
  return { ...set };
}

export function deleteClusterSetMock(id: string): boolean {
  const idx = state.clusterSets.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  state.clusterSets.splice(idx, 1);
  return true;
}

// Members resolve server-side from the label selector.
export function listClusterSetMembersMock(id: string): ServerCluster[] {
  const members: Record<string, ServerCluster[]> = {
    "cs-canary": [
      {
        id: "c-edge-1",
        orgId: "acme",
        name: "edge-1",
        state: "active",
        createdAt: new Date(Date.now() - 40 * 86400_000).toISOString(),
      },
    ],
    "cs-prod-eu": [
      {
        id: "c-eu-1",
        orgId: "acme",
        name: "eu-1",
        state: "active",
        createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
      },
      {
        id: "c-eu-2",
        orgId: "acme",
        name: "eu-2",
        state: "active",
        createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
      },
    ],
  };
  return (members[id] ?? []).map((c) => ({ ...c }));
}

/* ---- fleet: rollouts ---- */

interface RolloutStateInternal extends ServerRollout {
  polls: number;
  targets: ServerRolloutTarget[];
}

function seedRollout(): RolloutStateInternal {
  const now = Date.now();
  return {
    id: "ro-1",
    orgId: "acme",
    name: "cert-manager 1.16 rollout",
    kind: "capability",
    targetRef: "cert-manager",
    desiredVersion: "1.16.2",
    state: "running",
    stages: [
      {
        name: "canary",
        clusterSetIds: ["cs-canary"],
        maxConcurrency: "1",
        afterGate: { type: "auto" },
      },
      {
        name: "wave-1",
        clusterSetIds: ["cs-prod-eu"],
        maxConcurrency: "2",
        beforeGate: { type: "approval" },
      },
    ],
    currentStage: 0,
    createdBy: "me@inari.dev",
    createdAt: new Date(now - 3600_000).toISOString(),
    updatedAt: new Date(now - 3600_000).toISOString(),
    polls: 0,
    targets: [
      {
        rolloutId: "ro-1",
        clusterId: "c-edge-1",
        stage: 0,
        status: "deploying",
        observedHealth: "progressing",
        updatedAt: new Date(now - 3600_000).toISOString(),
      },
      {
        rolloutId: "ro-1",
        clusterId: "c-eu-1",
        stage: 1,
        status: "pending",
        updatedAt: new Date(now - 3600_000).toISOString(),
      },
      {
        rolloutId: "ro-1",
        clusterId: "c-eu-2",
        stage: 1,
        status: "pending",
        updatedAt: new Date(now - 3600_000).toISOString(),
      },
    ],
  };
}

function stripInternal(r: RolloutStateInternal): ServerRollout {
  const rest = { ...r } as Partial<RolloutStateInternal>;
  delete rest.polls;
  delete rest.targets;
  return rest as ServerRollout;
}

export function listRolloutMocks(tenant: string): ServerRollout[] {
  return state.rollouts
    .filter((r) => r.orgId === tenant)
    .map((r) => structuredClone(stripInternal(r)));
}

export function getRolloutMock(id: string): ServerRollout | undefined {
  const rollout = state.rollouts.find((r) => r.id === id);
  return rollout ? stripInternal(rollout) : undefined;
}

function setTargetStatus(
  rollout: RolloutStateInternal,
  stage: number,
  status: string,
  observedHealth?: string,
) {
  const now = new Date().toISOString();
  rollout.targets
    .filter((t) => t.stage === stage)
    .forEach((t) => {
      t.status = status;
      if (observedHealth !== undefined) t.observedHealth = observedHealth;
      t.updatedAt = now;
    });
}

// Each read advances the rollout so stage progress is visible live: canary
// goes healthy first, then wave-1 deploys and completes.
export function pollRolloutMock(id: string): ServerRollout | undefined {
  const rollout = state.rollouts.find((r) => r.id === id);
  if (!rollout) return undefined;
  if (rollout.state === "running") {
    rollout.polls += 1;
    if (rollout.polls >= 2) {
      setTargetStatus(rollout, 0, "healthy", "healthy");
      rollout.currentStage = 1;
      setTargetStatus(rollout, 1, "deploying", "progressing");
    }
    if (rollout.polls >= 4) {
      setTargetStatus(rollout, 1, "healthy", "healthy");
      rollout.state = "completed";
    }
    rollout.updatedAt = new Date().toISOString();
  }
  return structuredClone(stripInternal(rollout));
}

// Target reads reflect the current state without advancing it (the rollout
// read drives progression).
export function listRolloutTargetsMock(id: string): ServerRolloutTarget[] {
  const rollout = state.rollouts.find((r) => r.id === id);
  if (!rollout) return [];
  return structuredClone(rollout.targets);
}

export function rollbackRolloutMock(id: string): ServerRollout | undefined {
  const rollout = state.rollouts.find((r) => r.id === id);
  if (!rollout) return undefined;
  rollout.state = "rolled_back";
  rollout.targets.forEach((t) => {
    t.status = "pending";
    delete t.observedHealth;
    t.updatedAt = new Date().toISOString();
  });
  rollout.updatedAt = new Date().toISOString();
  return structuredClone(stripInternal(rollout));
}

/* ---- fleet: drift (report-only) ---- */

export function listDriftMocks(): ServerDriftEvent[] {
  return state.drift.map((d) => ({ ...d }));
}

/* ---- fleet: agent channels ---- */

export function listAgentChannelMocks(): ServerAgentChannel[] {
  return state.agentChannels.map((c) => ({ ...c }));
}

export function setAgentChannelMock(
  clusterSetId: string,
  channel: AgentChannel,
  desiredAgentVersion: string,
): ServerAgentChannel | undefined {
  const assignment = state.agentChannels.find((c) => c.clusterSetId === clusterSetId);
  if (!assignment) return undefined;
  assignment.channel = channel;
  assignment.desiredAgentVersion = desiredAgentVersion;
  assignment.updatedAt = new Date().toISOString();
  return { ...assignment };
}
