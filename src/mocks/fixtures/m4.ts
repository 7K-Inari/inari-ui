import type { components } from "@/api/__generated__/schema";
import type { UiExtensionRemoteViewModel } from "@/api/extensions";
import type { AgentChannel } from "@/api/fleet";
import { argocdBackendExtension, argocdRemote } from "@/mocks/fixtures/extensions";

// M4 fixtures: extension registry, templates/scaffolds, fleet (ClusterSets,
// rollouts + targets, drift, agent channels). Scaffold and fleet fixtures
// speak the huma wire shapes directly (src/api mappers are the source of
// truth). Poll-based mocks advance on each read, mirroring
// createDeployMock/pollDeployMock.

type ServerCluster = components["schemas"]["Cluster"];
type ServerClusterSet = components["schemas"]["ClusterSet"];
type ServerRollout = components["schemas"]["Rollout"];
type ServerRolloutTarget = components["schemas"]["RolloutTarget"];
type ServerDriftEvent = components["schemas"]["DriftEvent"];
type ServerAgentChannel = components["schemas"]["AgentChannel"];
type ServerTemplateDetail = components["schemas"]["TemplateDetail"];
type ServerTemplateSummary = components["schemas"]["TemplateSummary"];
type ServerRunView = components["schemas"]["RunView"];
type ServerStepView = components["schemas"]["StepView"];
type ServerCreateRunInputBody = components["schemas"]["CreateRunInputBody"];

interface M4State {
  uiExtensions: UiExtensionRemoteViewModel[];
  backendExtensions: ServerExtension[];
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
    scaffoldControl.failRuns = false;
  },
  failScaffoldRuns() {
    scaffoldControl.failRuns = true;
  },
};

export function listUiExtensionMocks(): UiExtensionRemoteViewModel[] {
  return state.uiExtensions.map((e) => ({ ...e }));
}

export function addUiExtensionMock(input: {
  name: string;
  remoteEntryUrl: string;
}): UiExtensionRemoteViewModel {
  const remote: UiExtensionRemoteViewModel = {
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

export function listBackendExtensionMocks(): ServerExtension[] {
  return state.backendExtensions.map((e) => ({ ...e }));
}

export const selfExtensionPermissions = [
  "extensions:invoke:inari-ext-argocd",
  "extensions:invoke:*",
];

/* ---- templates / scaffolds ---- */

const templates: ServerTemplateDetail[] = [
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

export function listTemplateMocks(): ServerTemplateSummary[] {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    displayName: t.displayName,
    description: t.description,
    tags: t.tags,
    version: t.version,
  }));
}

export function findTemplateMock(name: string): ServerTemplateDetail | undefined {
  const t = templates.find((tpl) => tpl.name === name);
  return t ? { ...t } : undefined;
}

// Canonical scaffold runs: RunView wire shape with per-step states. Each poll
// completes one step; m4MockControl.failScaffoldRuns() makes the next
// non-completed step fail so the retry path is exercisable.

const RUN_STEP_NAMES = [
  "render",
  "create-repo",
  "create-pipeline",
  "register-catalog",
  "bind-rbac",
];

interface ScaffoldState {
  run: ServerRunView;
  polls: number;
}

interface ScaffoldControlState {
  failRuns: boolean;
}

const scaffoldControl: ScaffoldControlState = { failRuns: false };

export function scaffoldMockControl() {
  return scaffoldControl;
}

function completedSteps(run: ServerRunView): number {
  return (run.steps ?? []).filter((s) => s.state === "completed").length;
}

function scaffoldOutputs(run: ServerRunView, serviceName: string) {
  const done = completedSteps(run);
  return {
    repoUrl:
      done >= RUN_STEP_NAMES.indexOf("create-repo") + 1
        ? `https://github.com/acme/${serviceName}`
        : null,
    pipelineUrl:
      done >= RUN_STEP_NAMES.indexOf("create-pipeline") + 1
        ? `https://github.com/acme/${serviceName}/actions`
        : null,
    catalogItemId:
      done >= RUN_STEP_NAMES.indexOf("register-catalog") + 1
        ? `discovered-${serviceName}`
        : null,
  };
}

export function createScaffoldRunMock(
  templateName: string,
  body: ServerCreateRunInputBody,
): ServerRunView {
  const template = findTemplateMock(templateName);
  const now = new Date().toISOString();
  const run: ServerRunView = {
    id: `scaf-${Math.random().toString(36).slice(2, 10)}`,
    templateName,
    version: template?.version ?? "0.0.0",
    displayName: body.displayName ?? templateName,
    phase: "pending",
    steps: RUN_STEP_NAMES.map(
      (name): ServerStepView => ({ name, state: "pending", attempts: 0 }),
    ),
    outputs: { repoUrl: null, pipelineUrl: null, catalogItemId: null },
    createdBy: "console-user",
    createdAt: now,
    updatedAt: now,
  };
  state.scaffoldRuns.push({ run, polls: 0 });
  return { ...run };
}

export function pollScaffoldRunMock(id: string): ServerRunView | undefined {
  const entry = state.scaffoldRuns.find((r) => r.run.id === id);
  if (!entry) return undefined;
  const { run } = entry;
  if (run.phase === "cancelled" || run.phase === "completed" || run.phase === "failed") {
    return { ...run };
  }
  entry.polls += 1;
  const steps = (run.steps ?? []).map((s) => ({ ...s }));
  const nextIdx = steps.findIndex((s) => s.state !== "completed");
  if (nextIdx === -1) {
    run.phase = "completed";
  } else if (scaffoldControl.failRuns) {
    steps[nextIdx] = {
      ...steps[nextIdx],
      state: "failed",
      attempts: steps[nextIdx].attempts + 1,
      error: "simulated scaffold failure",
    };
    run.phase = "failed";
    run.error = "simulated scaffold failure";
    scaffoldControl.failRuns = false;
  } else {
    steps[nextIdx] = {
      ...steps[nextIdx],
      state: "completed",
      attempts: steps[nextIdx].attempts + 1,
    };
    run.phase = nextIdx === steps.length - 1 ? "completed" : "running";
  }
  run.steps = steps;
  run.outputs = scaffoldOutputs(run, run.displayName);
  run.updatedAt = new Date().toISOString();
  return { ...run };
}

export function cancelScaffoldRunMock(id: string): ServerRunView | undefined {
  const entry = state.scaffoldRuns.find((r) => r.run.id === id);
  if (!entry) return undefined;
  const { run } = entry;
  if (run.phase !== "completed" && run.phase !== "failed") {
    run.phase = "cancelled";
    run.updatedAt = new Date().toISOString();
  }
  return { ...run };
}

export function retryScaffoldRunMock(id: string): ServerRunView | undefined {
  const entry = state.scaffoldRuns.find((r) => r.run.id === id);
  if (!entry) return undefined;
  const { run } = entry;
  if (run.phase !== "failed") return undefined;
  run.phase = "running";
  delete run.error;
  run.steps = (run.steps ?? []).map((s) =>
    s.state === "failed" ? { name: s.name, state: "pending", attempts: s.attempts } : { ...s },
  );
  run.updatedAt = new Date().toISOString();
  return { ...run };
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
