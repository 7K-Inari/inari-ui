import type { components } from "@/api/__generated__/schema";

type PolicyPack = components["schemas"]["PolicyPack"];
type PolicyAssignment = components["schemas"]["PolicyAssignment"];
type Exemption = components["schemas"]["Exemption"];
type Policy = components["schemas"]["Policy"];
type TenantGitConfig = components["schemas"]["TenantGitConfig"];
type PolicyDecision = components["schemas"]["PolicyDecision"];
type AssignPackRequest = components["schemas"]["AssignPackInputBody"];
type CreatePackRequest = components["schemas"]["CreatePackInputBody"];
type RequestExemptionRequest = components["schemas"]["RequestExemptionInputBody"];
type GitConfigRequest = components["schemas"]["GitConfigInputBody"];

// Slice-1 settings mocks: policy packs, exemptions, compliance policies,
// and tenant git config. Fixtures speak the huma wire shapes directly, so
// handlers wrap them in response envelopes without mapping.

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export interface PolicyMockState {
  packs: PolicyPack[];
  assignments: PolicyAssignment[];
  exemptions: Exemption[];
  policies: Policy[];
  gitConfigs: Record<string, TenantGitConfig>;
  nextEvaluateDecision: PolicyDecision | null;
}

export const baselinePack: PolicyPack = {
  id: "pp-baseline",
  name: "baseline-security",
  engine: "kyverno",
  version: "1.4.0",
  manifests: [],
  orgId: "acme",
  createdAt: iso(now - 5 * 86_400_000),
};

export const platformPack: PolicyPack = {
  id: "pp-platform-guardrails",
  name: "platform-guardrails",
  engine: "cel-vap",
  version: "2.0.1",
  manifests: [],
  createdAt: iso(now - 40 * 86_400_000),
};

export const pendingExemption: Exemption = {
  id: "ex-1",
  orgId: "acme",
  policyId: "pol-max-size",
  scope: {},
  reason: "Temporary bulk import exceeds quota",
  state: "pending",
  expiresAt: iso(now + 7 * 86_400_000),
  createdBy: "dev@acme.example",
  createdAt: iso(now - 86_400_000),
};

export const approvedExemption: Exemption = {
  id: "ex-2",
  orgId: "acme",
  policyId: "pol-image-registry",
  scope: {},
  reason: "Legacy registry migration",
  state: "approved",
  expiresAt: iso(now + 30 * 86_400_000),
  createdBy: "ops@acme.example",
  approvedBy: "pe@inari.dev",
  createdAt: iso(now - 10 * 86_400_000),
};

export const maxSizePolicy: Policy = {
  id: "pol-max-size",
  name: "inari.storage/max-size",
  target: "request",
  engine: "rego",
  source: "package inari.policy",
  enabled: true,
  version: 3,
  createdAt: iso(now - 60 * 86_400_000),
  updatedAt: iso(now - 2 * 86_400_000),
};

export const registryPolicy: Policy = {
  id: "pol-image-registry",
  name: "inari.images/approved-registry",
  target: "render",
  engine: "rego",
  source: "package inari.policy",
  enabled: false,
  version: 1,
  createdAt: iso(now - 90 * 86_400_000),
  updatedAt: iso(now - 30 * 86_400_000),
};

export const denyDecision: PolicyDecision = {
  allow: false,
  violations: [
    {
      rule: "inari.storage/max-size",
      reason: "storage.size 500Gi exceeds tenant quota of 100Gi",
      remediation: "Reduce spec.storage.size to 100Gi or less.",
    },
  ],
  warnings: [
    {
      rule: "inari.images/approved-registry",
      reason: "image registry not in the approved list",
      remediation: "Use registry.inari.io.",
      exempted: true,
    },
  ],
};

function seedState(): PolicyMockState {
  return {
    packs: [
      { ...baselinePack },
      { ...platformPack },
    ],
    assignments: [],
    exemptions: [{ ...pendingExemption }, { ...approvedExemption }],
    policies: [{ ...maxSizePolicy }, { ...registryPolicy }],
    gitConfigs: {
      acme: {
        orgId: "acme",
        repo: "acme/acme-inari-state",
        baseBranch: "main",
        commitPolicy: "pull_request",
      },
    },
    nextEvaluateDecision: null,
  };
}

let state: PolicyMockState = seedState();

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

export const policyMockControl = {
  reset() {
    state = seedState();
  },
  getState(): PolicyMockState {
    return state;
  },
};

export function packsFor(org: string): PolicyPack[] {
  return state.packs.filter((p) => !p.orgId || p.orgId === org);
}

export function createPackMock(org: string, body: CreatePackRequest): PolicyPack {
  const pack: PolicyPack = {
    id: nextId("pp"),
    name: body.name,
    engine: body.engine,
    version: body.version,
    manifests: body.manifests,
    ociRef: body.ociRef,
    orgId: org,
    createdAt: new Date().toISOString(),
  };
  state.packs.push(pack);
  return pack;
}

export function assignPackMock(
  packId: string,
  body: AssignPackRequest,
): PolicyAssignment | null {
  if (!state.packs.some((p) => p.id === packId)) return null;
  const assignment: PolicyAssignment = {
    id: nextId("pa"),
    packId,
    targetType: body.targetType,
    targetId: body.targetId,
    state: "active",
    createdAt: new Date().toISOString(),
  };
  state.assignments.push(assignment);
  return assignment;
}

export function unassignPackMock(packId: string, assignmentId: string): boolean {
  const before = state.assignments.length;
  state.assignments = state.assignments.filter(
    (a) => !(a.packId === packId && a.id === assignmentId),
  );
  return state.assignments.length < before;
}

export function exemptionsFor(org: string): Exemption[] {
  return state.exemptions.filter((e) => e.orgId === org);
}

export function requestExemptionMock(
  org: string,
  body: RequestExemptionRequest,
): Exemption {
  const exemption: Exemption = {
    id: nextId("ex"),
    orgId: org,
    policyId: body.policyId,
    scope: body.scope ?? {},
    reason: body.reason,
    state: "pending",
    expiresAt: body.expiresAt,
    createdBy: "me@inari.dev",
    createdAt: new Date().toISOString(),
  };
  state.exemptions.push(exemption);
  return exemption;
}

export function decideExemptionMock(id: string, approve: boolean): Exemption | null {
  const exemption = state.exemptions.find((e) => e.id === id);
  if (!exemption) return null;
  exemption.state = approve ? "approved" : "rejected";
  exemption.approvedBy = "pe@inari.dev";
  return exemption;
}

export function policiesFor(org: string): Policy[] {
  return state.policies.filter((p) => !p.orgId || p.orgId === org);
}

export function evaluateMock(): PolicyDecision {
  return state.nextEvaluateDecision ?? { allow: true, violations: [], warnings: [] };
}

export function gitConfigFor(org: string): TenantGitConfig | null {
  return state.gitConfigs[org] ?? null;
}

export function setGitConfigMock(org: string, body: GitConfigRequest): TenantGitConfig {
  const config: TenantGitConfig = {
    orgId: org,
    repo: body.repo,
    baseBranch: body.baseBranch ?? "main",
    commitPolicy: body.commitPolicy,
  };
  state.gitConfigs[org] = config;
  return config;
}
