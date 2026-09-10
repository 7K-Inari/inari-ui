import type { components } from "@/api/__generated__/schema";
import type { OidcClient, OidcClientInput, OidcScope } from "@/api/identity";
import type { ApprovalConfig } from "@/api/policies";
import type {
  SecretStore,
  SecretStoreInput,
  SecretStoreStatus,
} from "@/api/secrets";

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

export type Organization = components["schemas"]["Organization"];
export type Team = components["schemas"]["Team"];
export type MemberView = components["schemas"]["MemberView"];
export type RegistrationToken = components["schemas"]["RegistrationToken"];

// M6.W2: proposed wire shapes for routes not yet in the pinned contract
// (org PATCH, org-wide members, team CRUD, catalog visibility, token
// list/revoke). Swap for generated types after contract sync.
export interface CatalogVisibilityRule {
  itemId: string;
  itemName: string;
  visible: boolean;
  updatedBy: string;
  updatedAt: string;
}

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
  orgs: Record<string, Organization>;
  orgMembers: Record<string, MemberView[]>;
  teams: Record<string, Team[]>;
  teamMembers: Record<string, MemberView[]>;
  visibility: Record<string, CatalogVisibilityRule[]>;
  registrationTokens: Record<string, RegistrationToken[]>;
  oidcClients: Record<string, OidcClient[]>;
  approvalConfigs: Record<string, ApprovalConfig>;
  secretStores: Record<string, SecretStore[]>;
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
    orgs: {
      acme: {
        id: "t-acme",
        slug: "acme",
        displayName: "Acme Corp",
        keycloakOrgId: "kc-acme",
        createdAt: iso(now - 90 * 86_400_000),
      },
      globex: {
        id: "t-globex",
        slug: "globex",
        displayName: "Globex Inc",
        keycloakOrgId: "kc-globex",
        createdAt: iso(now - 60 * 86_400_000),
      },
    },
    orgMembers: {
      acme: [
        {
          userId: "u-admin",
          displayName: "Ada Admin",
          email: "ada@acme.example",
          role: "admin",
        },
        {
          userId: "u-dev",
          displayName: "Dev Dorian",
          email: "dorian@acme.example",
          role: "member",
        },
      ],
      globex: [
        {
          userId: "u-globex",
          displayName: "Gail Globex",
          email: "gail@globex.example",
          role: "admin",
        },
      ],
    },
    teams: {
      acme: [
        {
          id: "team-platform",
          orgId: "t-acme",
          name: "platform-team",
          keycloakGroupPath: "/acme/platform-team",
          createdAt: iso(now - 80 * 86_400_000),
        },
      ],
      globex: [],
    },
    teamMembers: {
      "acme/platform-team": [
        {
          userId: "u-admin",
          displayName: "Ada Admin",
          email: "ada@acme.example",
          role: "admin",
        },
      ],
    },
    visibility: {
      acme: [
        {
          itemId: "postgres",
          itemName: "PostgreSQL",
          visible: true,
          updatedBy: "pe@inari.dev",
          updatedAt: iso(now - 3 * 86_400_000),
        },
        {
          itemId: "redis",
          itemName: "Redis",
          visible: false,
          updatedBy: "pe@inari.dev",
          updatedAt: iso(now - 2 * 86_400_000),
        },
      ],
      globex: [],
    },
    registrationTokens: {},
    oidcClients: {
      acme: [
        {
          id: "oc-cli",
          orgId: "acme",
          name: "inari-cli",
          description: "Public client for the Inari CLI",
          redirectUris: ["http://localhost:8976/callback"],
          grantTypes: ["authorization_code", "refresh_token"],
          isPublic: true,
          scopes: ["clusters:read", "catalog:read"],
          createdAt: iso(now - 50 * 86_400_000),
        },
        {
          id: "oc-ci",
          orgId: "acme",
          name: "ci-deployer",
          description: "Service client for CI pipelines",
          redirectUris: [],
          grantTypes: ["client_credentials"],
          isPublic: false,
          scopes: ["deploys:write"],
          createdAt: iso(now - 20 * 86_400_000),
        },
      ],
      globex: [],
    },
    approvalConfigs: {
      acme: {
        orgId: "acme",
        thresholds: [
          { action: "deploy", approvalsRequired: 1 },
          { action: "zone-decommission", approvalsRequired: 2 },
        ],
        approverGroups: ["tenant-acme/platform-team"],
        autoApproveRules: [{ action: "deploy", condition: "env == 'dev'" }],
        updatedBy: "pe@inari.dev",
        updatedAt: iso(now - 4 * 86_400_000),
      },
    },
    secretStores: {
      acme: [
        {
          name: "inari-platform",
          orgId: "acme",
          scope: "platform",
          clusterIds: ["*"],
          provider: {
            type: "awsSM",
            region: "us-east-1",
            authSecretRef: { name: "inari-platform-creds", namespace: "inari-system" },
          },
          createdAt: iso(now - 120 * 86_400_000),
        },
        {
          name: "acme-vault",
          orgId: "acme",
          scope: "cluster",
          clusterIds: ["cl-kind-dev"],
          provider: {
            type: "vault",
            url: "https://vault.acme.example",
            authSecretRef: { name: "eso-vault-token", namespace: "external-secrets" },
          },
          createdAt: iso(now - 15 * 86_400_000),
        },
      ],
      globex: [],
    },
  };
}

let state: PolicyMockState = seedState();

// Start above the seeded id range (ex-1/ex-2, pp-*) so generated ids never
// collide with fixtures.
let idCounter = 100;
const nextId = (prefix: string) => `${prefix}-gen${++idCounter}`;

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

// ---- M6.W2: org profile / members / teams / visibility / tokens ----

export function listOrgsMock(): Organization[] {
  return Object.values(state.orgs);
}

export function getOrgMock(slug: string): Organization | null {
  return state.orgs[slug] ?? null;
}

export function patchOrgMock(slug: string, displayName: string): Organization | null {
  const org = state.orgs[slug];
  if (!org) return null;
  org.displayName = displayName;
  return org;
}

export function orgMembersFor(org: string): MemberView[] {
  return state.orgMembers[org] ?? [];
}

export function putOrgMemberMock(
  org: string,
  subject: string,
  body: { email: string; displayName?: string; role: string },
): MemberView {
  const members = (state.orgMembers[org] ??= []);
  const existing = members.find((m) => m.userId === subject);
  if (existing) {
    existing.role = body.role;
    existing.email = body.email;
    if (body.displayName) existing.displayName = body.displayName;
    return existing;
  }
  const member: MemberView = {
    userId: subject,
    displayName: body.displayName ?? body.email,
    email: body.email,
    role: body.role,
  };
  members.push(member);
  return member;
}

export function deleteOrgMemberMock(org: string, subject: string): boolean {
  const members = state.orgMembers[org] ?? [];
  const before = members.length;
  state.orgMembers[org] = members.filter((m) => m.userId !== subject);
  return state.orgMembers[org].length < before;
}

export function teamsFor(org: string): Team[] {
  return state.teams[org] ?? [];
}

export function createTeamMock(org: string, name: string): Team {
  const teams = (state.teams[org] ??= []);
  const team: Team = {
    id: nextId("team"),
    orgId: state.orgs[org]?.id ?? `t-${org}`,
    name,
    keycloakGroupPath: `/${org}/${name}`,
    createdAt: new Date().toISOString(),
  };
  teams.push(team);
  return team;
}

export function deleteTeamMock(org: string, name: string): boolean {
  const teams = state.teams[org] ?? [];
  const before = teams.length;
  state.teams[org] = teams.filter((t) => t.name !== name);
  delete state.teamMembers[`${org}/${name}`];
  return state.teams[org].length < before;
}

export function teamMembersFor(org: string, team: string): MemberView[] {
  return state.teamMembers[`${org}/${team}`] ?? [];
}

export function addTeamMemberMock(org: string, team: string, subject: string): boolean {
  if (!teamsFor(org).some((t) => t.name === team)) return false;
  const orgMember = orgMembersFor(org).find((m) => m.userId === subject);
  const member: MemberView = orgMember ?? {
    userId: subject,
    displayName: subject,
    email: "",
    role: "member",
  };
  const members = (state.teamMembers[`${org}/${team}`] ??= []);
  if (!members.some((m) => m.userId === subject)) members.push(member);
  return true;
}

export function removeTeamMemberMock(org: string, team: string, subject: string): boolean {
  const key = `${org}/${team}`;
  const members = state.teamMembers[key] ?? [];
  const before = members.length;
  state.teamMembers[key] = members.filter((m) => m.userId !== subject);
  return state.teamMembers[key].length < before;
}

export function visibilityFor(org: string): CatalogVisibilityRule[] {
  return state.visibility[org] ?? [];
}

export function putVisibilityMock(
  org: string,
  itemId: string,
  visible: boolean,
): CatalogVisibilityRule {
  const rules = (state.visibility[org] ??= []);
  const existing = rules.find((r) => r.itemId === itemId);
  if (existing) {
    existing.visible = visible;
    existing.updatedBy = "me@inari.dev";
    existing.updatedAt = new Date().toISOString();
    return existing;
  }
  const rule: CatalogVisibilityRule = {
    itemId,
    itemName: itemId,
    visible,
    updatedBy: "me@inari.dev",
    updatedAt: new Date().toISOString(),
  };
  rules.push(rule);
  return rule;
}

export function registrationTokensFor(clusterId: string): RegistrationToken[] {
  return state.registrationTokens[clusterId] ?? [];
}

export function recordRegistrationTokenMock(
  clusterId: string,
): RegistrationToken {
  const tokens = (state.registrationTokens[clusterId] ??= []);
  const record: RegistrationToken = {
    id: nextId("rt"),
    clusterId,
    createdBy: "me@inari.dev",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
  tokens.push(record);
  return record;
}

export function revokeRegistrationTokenMock(clusterId: string, tokenId: string): boolean {
  const tokens = state.registrationTokens[clusterId] ?? [];
  const before = tokens.length;
  state.registrationTokens[clusterId] = tokens.filter((t) => t.id !== tokenId);
  return state.registrationTokens[clusterId].length < before;
}

// ---- M6.W3: identity (OIDC clients / scopes) and approvals config ----

export const oidcScopesCatalog: OidcScope[] = [
  { name: "clusters:read", description: "Read tenant clusters", audience: "inari-clusters" },
  { name: "clusters:write", description: "Register and remove clusters", audience: "inari-clusters" },
  { name: "deploys:write", description: "Create and upgrade deploys", audience: "inari-deploys" },
  { name: "catalog:read", description: "Browse the service catalog", audience: "inari-catalog" },
];

export function oidcClientsFor(org: string): OidcClient[] {
  return state.oidcClients[org] ?? [];
}

export function findOidcClient(org: string, id: string): OidcClient | null {
  return oidcClientsFor(org).find((c) => c.id === id) ?? null;
}

export function createOidcClientMock(org: string, body: OidcClientInput): OidcClient {
  const clients = (state.oidcClients[org] ??= []);
  const client: OidcClient = {
    id: nextId("oc"),
    orgId: org,
    name: body.name,
    description: body.description,
    redirectUris: body.redirectUris ?? [],
    grantTypes: body.grantTypes ?? [],
    isPublic: body.isPublic ?? false,
    scopes: [],
    createdAt: new Date().toISOString(),
  };
  clients.push(client);
  return client;
}

export function updateOidcClientMock(
  org: string,
  id: string,
  body: OidcClientInput,
): OidcClient | null {
  const client = findOidcClient(org, id);
  if (!client) return null;
  client.name = body.name;
  client.description = body.description;
  client.redirectUris = body.redirectUris ?? [];
  client.grantTypes = body.grantTypes ?? [];
  client.isPublic = body.isPublic ?? false;
  return client;
}

export function deleteOidcClientMock(org: string, id: string): boolean {
  const clients = state.oidcClients[org] ?? [];
  const before = clients.length;
  state.oidcClients[org] = clients.filter((c) => c.id !== id);
  return state.oidcClients[org].length < before;
}

export function putClientScopesMock(org: string, id: string, scopes: string[]): OidcClient | null {
  const client = findOidcClient(org, id);
  if (!client) return null;
  client.scopes = scopes;
  return client;
}

export function approvalConfigFor(org: string): ApprovalConfig {
  return (
    state.approvalConfigs[org] ?? {
      orgId: org,
      thresholds: [],
      approverGroups: [],
      autoApproveRules: [],
      updatedBy: "",
      updatedAt: new Date(now).toISOString(),
    }
  );
}

export function putApprovalConfigMock(
  org: string,
  body: Pick<ApprovalConfig, "thresholds" | "approverGroups" | "autoApproveRules">,
): ApprovalConfig {
  const config: ApprovalConfig = {
    orgId: org,
    thresholds: body.thresholds ?? [],
    approverGroups: body.approverGroups ?? [],
    autoApproveRules: body.autoApproveRules ?? [],
    updatedBy: "me@inari.dev",
    updatedAt: new Date().toISOString(),
  };
  state.approvalConfigs[org] = config;
  return config;
}

// ---- M6.W4: ESO secret-store registry ----

export function secretStoresFor(org: string): SecretStore[] {
  return state.secretStores[org] ?? [];
}

export function findSecretStore(org: string, name: string): SecretStore | null {
  return secretStoresFor(org).find((s) => s.name === name) ?? null;
}

export function createSecretStoreMock(org: string, body: SecretStoreInput): SecretStore {
  const stores = (state.secretStores[org] ??= []);
  const store: SecretStore = {
    name: body.name,
    orgId: org,
    scope: "cluster",
    clusterIds: body.clusterIds ?? [],
    provider: body.provider,
    createdAt: new Date().toISOString(),
  };
  stores.push(store);
  return store;
}

export function updateSecretStoreMock(
  org: string,
  name: string,
  body: SecretStoreInput,
): SecretStore | null {
  const store = findSecretStore(org, name);
  if (!store) return null;
  store.clusterIds = body.clusterIds ?? [];
  store.provider = body.provider;
  return store;
}

export function deleteSecretStoreMock(org: string, name: string): boolean {
  const stores = state.secretStores[org] ?? [];
  const before = stores.length;
  state.secretStores[org] = stores.filter((s) => s.name !== name);
  return state.secretStores[org].length < before;
}

export function secretStoreStatusFor(org: string, name: string): SecretStoreStatus | null {
  const store = findSecretStore(org, name);
  if (!store) return null;
  if (store.scope === "platform") {
    return {
      name: store.name,
      delivered: true,
      conditions: [
        {
          type: "Ready",
          status: "True",
          reason: "Reconciled",
          lastTransitionTime: store.createdAt,
        },
      ],
    };
  }
  return {
    name: store.name,
    delivered: false,
    conditions: [
      {
        type: "Ready",
        status: "False",
        reason: "WaitingForAgent",
        message: "Waiting for the cluster agent to reconcile the SecretStore.",
        lastTransitionTime: store.createdAt,
      },
    ],
  };
}
