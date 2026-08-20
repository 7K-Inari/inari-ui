import type { BackendExtension, UiExtensionRemote } from "@/api/extensions";
import type {
  AgentChannel,
  AgentChannelAssignment,
  ClusterSet,
  DriftEntry,
  Rollout,
} from "@/api/fleet";
import type {
  CreateScaffoldRequest,
  ScaffoldOutputs,
  ScaffoldPhase,
  ScaffoldRun,
  TemplateDetail,
} from "@/api/templates";
import { argocdBackendExtension, argocdRemote } from "@/mocks/fixtures/extensions";

// M4 fixtures: extension registry, templates/scaffolds, fleet (ClusterSets,
// rollouts, drift, agent channels). Poll-based mocks advance on each read,
// mirroring createDeployMock/pollDeployMock.

/* ---- extensions ---- */

interface M4State {
  uiExtensions: UiExtensionRemote[];
  backendExtensions: BackendExtension[];
  scaffoldRuns: ScaffoldState[];
  clusterSets: ClusterSet[];
  rollouts: RolloutStateInternal[];
  drift: DriftEntry[];
  agentChannels: AgentChannelAssignment[];
}

function seedState(): M4State {
  return {
    uiExtensions: [{ ...argocdRemote }],
    backendExtensions: [{ ...argocdBackendExtension }],
    scaffoldRuns: [],
    clusterSets: [
      {
        id: "cs-canary",
        name: "canary",
        tenant: "acme",
        labels: { wave: "canary" },
        memberClusterIds: ["c-edge-1"],
        createdAt: new Date(Date.now() - 40 * 86400_000).toISOString(),
      },
      {
        id: "cs-prod-eu",
        name: "prod-eu",
        tenant: "acme",
        labels: { region: "eu", env: "prod" },
        memberClusterIds: ["c-eu-1", "c-eu-2"],
        createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
      },
    ],
    rollouts: [
      {
        id: "ro-1",
        name: "cert-manager 1.16 rollout",
        tenant: "acme",
        target: { kind: "capability", name: "cert-manager", version: "1.16.2" },
        clusterSetId: "cs-prod-eu",
        clusterSetName: "prod-eu",
        state: "running",
        stages: makeStages(),
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
        polls: 0,
      },
    ],
    drift: [
      {
        id: "drift-1",
        clusterId: "c-eu-1",
        clusterName: "eu-1",
        resourceKind: "Deployment",
        name: "payments-api",
        namespace: "payments",
        field: "spec.replicas",
        desired: "3",
        reported: "5",
        detectedAt: new Date(Date.now() - 7200_000).toISOString(),
      },
      {
        id: "drift-2",
        clusterId: "c-edge-1",
        clusterName: "edge-1",
        resourceKind: "ConfigMap",
        name: "ingress-config",
        namespace: "inari-system",
        field: "data.logLevel",
        desired: "info",
        reported: "debug",
        detectedAt: new Date(Date.now() - 1800_000).toISOString(),
      },
    ],
    agentChannels: [
      {
        clusterSetId: "cs-canary",
        clusterSetName: "canary",
        channel: "canary",
        currentVersion: "1.9.0-rc.1",
        latestVersion: "1.9.0-rc.2",
        minSupportedVersion: "1.8.0",
      },
      {
        clusterSetId: "cs-prod-eu",
        clusterSetName: "prod-eu",
        channel: "stable",
        currentVersion: "1.8.3",
        latestVersion: "1.8.3",
        minSupportedVersion: "1.7.0",
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
  const { polls: _polls, ...rest } = run;
  return rest;
}

export function pollScaffoldMock(id: string): ScaffoldRun | undefined {
  const run = state.scaffoldRuns.find((r) => r.id === id);
  if (!run) return undefined;
  run.polls += 1;
  run.phase = SCAFFOLD_PHASES[Math.min(run.polls, SCAFFOLD_PHASES.length - 1)];
  run.outputs = scaffoldOutputs(run);
  const { polls: _polls, ...rest } = run;
  return rest;
}

/* ---- fleet: ClusterSets ---- */

export function listClusterSetMocks(tenant: string): ClusterSet[] {
  return state.clusterSets.filter((s) => s.tenant === tenant).map((s) => ({ ...s }));
}

export function getClusterSetMock(id: string): ClusterSet | undefined {
  const set = state.clusterSets.find((s) => s.id === id);
  return set ? { ...set } : undefined;
}

export function createClusterSetMock(
  tenant: string,
  input: { name: string; labels: Record<string, string> },
): ClusterSet {
  const set: ClusterSet = {
    id: `cs-${input.name}`,
    name: input.name,
    tenant,
    labels: input.labels,
    memberClusterIds: [],
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

/* ---- fleet: rollouts ---- */

interface RolloutStateInternal extends Rollout {
  polls: number;
}

function makeStages(): Rollout["stages"] {
  return [
    {
      name: "canary",
      kind: "canary",
      clusters: [
        { clusterId: "c-edge-1", clusterName: "edge-1", state: "deploying", message: null },
      ],
      gate: { type: "auto", state: "closed" },
    },
    {
      name: "wave-1",
      kind: "wave",
      clusters: [
        { clusterId: "c-eu-1", clusterName: "eu-1", state: "pending", message: null },
        { clusterId: "c-eu-2", clusterName: "eu-2", state: "pending", message: null },
      ],
      gate: { type: "approval", state: "closed" },
    },
  ];
}

export function listRolloutMocks(tenant: string): Rollout[] {
  return state.rollouts
    .filter((r) => r.tenant === tenant)
    .map(({ polls: _polls, ...rest }) => structuredClone(rest));
}

// Each read advances cluster states so rollout progress is visible live.
export function pollRolloutMock(id: string): Rollout | undefined {
  const rollout = state.rollouts.find((r) => r.id === id);
  if (!rollout) return undefined;
  if (rollout.state === "running" || rollout.state === "waiting-approval") {
    rollout.polls += 1;
    const canary = rollout.stages[0];
    if (rollout.polls >= 2) {
      canary.clusters.forEach((c) => (c.state = "healthy"));
      canary.gate.state = "approved";
      if (rollout.stages[1].gate.state === "closed") {
        rollout.stages[1].gate.state = "open";
        rollout.state = "waiting-approval";
      }
    }
    if (rollout.stages[1].gate.state === "approved") {
      rollout.stages[1].clusters.forEach((c) => (c.state = "healthy"));
      rollout.state = "completed";
    }
  }
  const { polls: _polls, ...rest } = rollout;
  return structuredClone(rest);
}

export function decideGateMock(
  rolloutId: string,
  stageName: string,
  decision: "approve" | "reject",
): Rollout | undefined {
  const rollout = state.rollouts.find((r) => r.id === rolloutId);
  const stage = rollout?.stages.find((s) => s.name === stageName);
  if (!rollout || !stage || stage.gate.state !== "open") return undefined;
  stage.gate.state = decision === "approve" ? "approved" : "rejected";
  if (decision === "reject") {
    rollout.state = "failed";
  } else {
    stage.clusters.forEach((c) => (c.state = "healthy"));
    rollout.state = "completed";
  }
  const { polls: _polls, ...rest } = rollout;
  return structuredClone(rest);
}

export function rollbackRolloutMock(id: string): Rollout | undefined {
  const rollout = state.rollouts.find((r) => r.id === id);
  if (!rollout) return undefined;
  rollout.state = "rolled-back";
  rollout.stages.forEach((s) =>
    s.clusters.forEach((c) => {
      if (c.state !== "pending") c.state = "pending";
    }),
  );
  const { polls: _polls, ...rest } = rollout;
  return structuredClone(rest);
}

/* ---- fleet: drift (report-only) ---- */

export function listDriftMocks(): DriftEntry[] {
  return state.drift.map((d) => ({ ...d }));
}

/* ---- fleet: agent channels ---- */

export function listAgentChannelMocks(): AgentChannelAssignment[] {
  return state.agentChannels.map((c) => ({ ...c }));
}

export function setAgentChannelMock(
  clusterSetId: string,
  channel: AgentChannel,
): AgentChannelAssignment | undefined {
  const assignment = state.agentChannels.find((c) => c.clusterSetId === clusterSetId);
  if (!assignment) return undefined;
  assignment.channel = channel;
  return { ...assignment };
}
