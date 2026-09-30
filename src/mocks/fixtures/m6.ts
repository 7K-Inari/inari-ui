import type { components } from "@/api/__generated__/schema";
import type { NotificationEndpoint } from "@/api/notifications";
import type { OidcClient, OidcClientInput, OidcScope } from "@/api/identity";
import type {
  OidcProvider,
  OidcProviderInput,
} from "@/api/idp";
import type { ApprovalConfig } from "@/api/policies";
import type {
  CreateSecretStoreInput,
  SecretStore,
  SecretStoreStatus,
  UpdateSecretStoreInput,
} from "@/api/secret-stores";

type PolicyPack = components["schemas"]["PolicyPack"];
type PolicyAssignment = components["schemas"]["PolicyAssignment"];
type Exemption = components["schemas"]["Exemption"];
type Policy = components["schemas"]["Policy"];
type TenantGitConfig = components["schemas"]["TenantGitConfig"];
type PolicyDecision = components["schemas"]["PolicyDecision"];
type AssignPackRequest = components["schemas"]["AssignPackInputBody"];
type CreatePackRequest = components["schemas"]["CreatePackInputBody"];
type RequestExemptionRequest =
  components["schemas"]["RequestExemptionInputBody"];
type GitConfigRequest = components["schemas"]["GitConfigInputBody"];

export type Organization = components["schemas"]["Organization"];
export type Team = components["schemas"]["Team"];
export type MemberView = components["schemas"]["MemberView"];
export type OrgMemberView = components["schemas"]["OrgMemberView"];
export type Role = components["schemas"]["Role"];
export type Permission = components["schemas"]["Permission"];
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
  orgMembers: Record<string, OrgMemberView[]>;
  // M1.W2 role engine (ADR-0013): org roles over the static permission
  // catalog; built-ins are seeded per tenant.
  roles: Record<string, Role[]>;
  // M1.W1 RBAC Phase A: platform admins (GET/PUT/DELETE /platform/admins) and
  // the per-tenant capability projection on GET /me/permissions. Proposed
  // wire shapes — swap for generated types after contract sync.
  platformAdmins: MockPlatformAdmin[];
  tenantCapabilities: Record<string, Record<string, boolean>>;
  teams: Record<string, Team[]>;
  teamMembers: Record<string, MemberView[]>;
  visibility: Record<string, CatalogVisibilityRule[]>;
  registrationTokens: Record<string, RegistrationToken[]>;
  oidcClients: Record<string, OidcClient[]>;
  approvalConfigs: Record<string, ApprovalConfig>;
  secretStores: Record<string, SecretStore[]>;
  idpProviders: Record<string, OidcProvider>;
  notificationEndpoints: Record<string, NotificationEndpoint[]>;
  // Domains claimed across all orgs, for login routing 409s.
  claimedDomains: Record<string, string>;
  gitConnections: Record<string, MockGitConnection[]>;
  gitProviders: Record<string, MockGitProvider[]>;
  gitAuthorizeError: { status: number; detail: string } | null;
  gitDisconnectError: { status: number; detail: string } | null;
}

// M1.W5: usergit wire shapes (per-user Git connections). Mirrors the W4
// server contract; metadata-only — tokens never appear here. Swap for
// generated types after contract sync.
export interface MockGitConnection {
  provider: string;
  providerLogin: string;
  scopes?: string;
  apiBase?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
}

export interface MockGitProvider {
  id: string;
  enabled: boolean;
  apiBase?: string | null;
}

// Wire shape: components.schemas.PlatformAdminView (all fields required).
export interface MockPlatformAdmin {
  userId: string;
  email: string;
  displayName: string;
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

// ADR-0013 static permission catalog (mirrors inari-server
// internal/authz/permissions.go): the only thing the FGA model encodes.
const PERMISSION_CATALOG: Permission[] = [
  { slug: "tenant.read", name: "Read organization", description: "View organization settings and resources.", domain: "tenant" },
  { slug: "tenant.settings.write", name: "Write settings", description: "Edit organization settings and git config.", domain: "tenant" },
  { slug: "tenant.members.manage", name: "Manage members", description: "Invite and remove organization members.", domain: "tenant" },
  { slug: "tenant.teams.manage", name: "Manage teams", description: "Create, edit, and delete teams.", domain: "tenant" },
  { slug: "tenant.rbac.manage", name: "Manage roles", description: "Create and edit roles and team role mappings.", domain: "tenant" },
  { slug: "tenant.identity.manage", name: "Manage identity", description: "Manage OIDC clients and scopes.", domain: "tenant" },
  { slug: "tenant.notifications.manage", name: "Manage notifications", description: "Manage notification endpoints.", domain: "tenant" },
  { slug: "tenant.admin", name: "Organization admin", description: "Destructive tenant operations; the guardrail anchor.", domain: "tenant" },
  { slug: "clusters.register", name: "Register clusters", description: "Register and manage clusters.", domain: "fleet" },
  { slug: "cloudaccounts.manage", name: "Manage cloud accounts", description: "Connect and validate cloud accounts.", domain: "fleet" },
  { slug: "zones.manage", name: "Manage zones", description: "Vend and manage tenant zones.", domain: "fleet" },
  { slug: "fleet.manage", name: "Manage fleet", description: "Manage cluster sets and fleet rollouts.", domain: "fleet" },
  { slug: "policies.manage", name: "Manage policies", description: "Manage policy packs and assignments.", domain: "governance" },
  { slug: "secretstores.manage", name: "Manage secret stores", description: "Manage secret store integrations.", domain: "governance" },
  { slug: "extensions.manage", name: "Manage extensions", description: "Install and configure extensions.", domain: "extensions" },
  { slug: "extensions.invoke", name: "Invoke extensions", description: "Invoke installed extensions.", domain: "extensions" },
  { slug: "catalog.manage", name: "Manage catalog", description: "Curate the service catalog.", domain: "catalog" },
  { slug: "deployments.create", name: "Create deployments", description: "Deploy from the catalog.", domain: "catalog" },
  { slug: "approvals.manage", name: "Manage approvals", description: "Decide approval requests.", domain: "catalog" },
];

// Bundles mirror the retired hierarchy (ADR-0013): names double as the
// pinned ClusterRole suffixes.
function builtinRoles(orgId: string): Role[] {
  const createdAt = iso(now - 90 * 86_400_000);
  const role = (
    name: string,
    displayName: string,
    description: string,
    permissions: string[],
  ): Role => ({
    id: `role-${name}`,
    orgId,
    name,
    displayName,
    description,
    builtin: true,
    permissions,
    createdAt,
    updatedAt: createdAt,
  });
  const all = PERMISSION_CATALOG.map((p) => p.slug);
  return [
    role("admin", "Admin", "Full organization administration.", all),
    role("operator", "Operator", "Platform operations without tenant administration.", all.filter((p) => p !== "tenant.admin")),
    role("editor", "Editor", "Deploy and manage day-to-day resources.", ["tenant.read", "catalog.manage", "deployments.create", "approvals.manage", "extensions.invoke"]),
    role("viewer", "Viewer", "Read-only access.", ["tenant.read"]),
  ];
}

function seedState(): PolicyMockState {
  return {
    packs: [{ ...baselinePack }, { ...platformPack }],
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
        status: "active",
        createdAt: iso(now - 90 * 86_400_000),
      },
      globex: {
        id: "t-globex",
        slug: "globex",
        displayName: "Globex Inc",
        keycloakOrgId: "kc-globex",
        status: "active",
        createdAt: iso(now - 60 * 86_400_000),
      },
    },
    orgMembers: {
      acme: [
        {
          userId: "u-admin",
          displayName: "Ada Admin",
          email: "ada@acme.example",
          roles: ["admin"],
          teams: ["platform-team"],
        },
        {
          userId: "u-dev",
          displayName: "Dev Dorian",
          email: "dorian@acme.example",
          roles: ["editor"],
          teams: [],
        },
      ],
      globex: [
        {
          userId: "u-globex",
          displayName: "Gail Globex",
          email: "gail@globex.example",
          roles: ["admin"],
          teams: [],
        },
      ],
    },
    roles: {
      acme: builtinRoles("t-acme"),
      globex: builtinRoles("t-globex"),
    },
    teams: {
      acme: [
        {
          id: "team-platform",
          orgId: "t-acme",
          name: "platform-team",
          displayName: "Platform Team",
          roleId: "admin",
          roleName: "admin",
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
          clientId: "org-acme-inari-cli",
          name: "inari-cli",
          type: "public",
          audiences: ["inari-server"],
          redirectUris: ["http://localhost:8976/callback"],
          scopes: ["inari-server:read", "inari-catalog:read"],
          status: "active",
          createdAt: iso(now - 50 * 86_400_000),
        },
        {
          clientId: "org-acme-ci-deployer",
          name: "ci-deployer",
          type: "service",
          audiences: ["inari-catalog"],
          redirectUris: [],
          scopes: ["inari-catalog:deploy"],
          status: "active",
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
          id: "ss-inari-platform",
          name: "inari-platform",
          orgId: "acme",
          scope: "platform",
          targets: { clusterIds: ["*"] },
          provider: {
            awsSM: {
              region: "us-east-1",
              authSecretRef: {
                name: "inari-platform-creds",
                namespace: "inari-system",
              },
            },
          },
          createdAt: iso(now - 120 * 86_400_000),
          updatedAt: iso(now - 120 * 86_400_000),
        },
        {
          id: "ss-acme-vault",
          name: "acme-vault",
          orgId: "acme",
          scope: "cluster",
          targets: { clusterIds: ["cl-kind-dev"] },
          provider: {
            vault: {
              server: "https://vault.acme.example",
              authSecretRef: {
                name: "eso-vault-token",
                namespace: "external-secrets",
              },
            },
          },
          createdAt: iso(now - 15 * 86_400_000),
          updatedAt: iso(now - 15 * 86_400_000),
        },
      ],
      globex: [],
    },
    idpProviders: {},
    notificationEndpoints: {
      acme: [
        {
          id: "ne-slack-ops",
          orgId: "acme",
          name: "ops-slack",
          kind: "slack",
          url: "https://hooks.slack.com/services/T000/B000/secret-token",
          events: ["approval.requested", "approval.decided"],
          enabled: true,
          createdAt: iso(now - 12 * 86_400_000),
        },
        {
          id: "ne-hook-audit",
          orgId: "acme",
          name: "audit-webhook",
          kind: "webhook",
          url: "https://webhook.site/00000000-0000-4000-8000-000000000000",
          events: null,
          enabled: false,
          createdAt: iso(now - 6 * 86_400_000),
        },
      ],
      globex: [],
    },
    // globex has already claimed example.com; acme starts with no IdP.
    claimedDomains: { "example.com": "globex" },
    gitConnections: {
      acme: [
        {
          provider: "github",
          providerLogin: "ada-dev",
          scopes: "repo read:org",
          createdAt: iso(now - 20 * 86_400_000),
          lastUsedAt: iso(now - 3_600_000),
        },
      ],
    },
    gitProviders: {
      acme: [
        { id: "github", enabled: true },
        { id: "gitlab", enabled: false },
        { id: "forgejo", enabled: false },
      ],
      globex: [{ id: "github", enabled: true }],
    },
    gitAuthorizeError: null,
    gitDisconnectError: null,
    platformAdmins: [
      { userId: "u-root", email: "root@inari.dev", displayName: "Root Admin" },
    ],
    tenantCapabilities: {
      acme: {
        canManageMembers: true,
        canManageTeams: true,
        canManageRbac: true,
      },
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

export function createPackMock(
  org: string,
  body: CreatePackRequest,
): PolicyPack {
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

export function unassignPackMock(
  packId: string,
  assignmentId: string,
): boolean {
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

export function decideExemptionMock(
  id: string,
  approve: boolean,
): Exemption | null {
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
  return (
    state.nextEvaluateDecision ?? { allow: true, violations: [], warnings: [] }
  );
}

export function gitConfigFor(org: string): TenantGitConfig | null {
  return state.gitConfigs[org] ?? null;
}

export function setGitConfigMock(
  org: string,
  body: GitConfigRequest,
): TenantGitConfig {
  const config: TenantGitConfig = {
    orgId: org,
    repo: body.repo,
    baseBranch: body.baseBranch ?? "main",
    commitPolicy: body.commitPolicy,
  };
  state.gitConfigs[org] = config;
  return config;
}

// ---- M1.W5: per-user git connections ----

export function gitConnectionsFor(org: string): MockGitConnection[] {
  return state.gitConnections[org] ?? [];
}

export function gitProvidersFor(org: string): MockGitProvider[] {
  return state.gitProviders[org] ?? [];
}

export function connectGitProviderMock(
  org: string,
  provider: string,
): MockGitConnection {
  const existing = gitConnectionsFor(org).find((c) => c.provider === provider);
  if (existing) return existing;
  const connection: MockGitConnection = {
    provider,
    providerLogin: `${provider}-user`,
    scopes: "repo",
    createdAt: new Date().toISOString(),
  };
  state.gitConnections[org] = [...gitConnectionsFor(org), connection];
  return connection;
}

export function disconnectGitProviderMock(org: string, provider: string): boolean {
  const before = gitConnectionsFor(org).length;
  state.gitConnections[org] = gitConnectionsFor(org).filter(
    (c) => c.provider !== provider,
  );
  return gitConnectionsFor(org).length < before;
}

// ---- M6.W2: org profile / members / teams / visibility / tokens ----

export function listOrgsMock(): Organization[] {
  return Object.values(state.orgs);
}

export function getOrgMock(slug: string): Organization | null {
  return state.orgs[slug] ?? null;
}

export function patchOrgMock(
  slug: string,
  displayName: string,
): Organization | null {
  const org = state.orgs[slug];
  if (!org) return null;
  org.displayName = displayName;
  return org;
}

export function orgMembersFor(org: string): OrgMemberView[] {
  return state.orgMembers[org] ?? [];
}

// subject is a Keycloak UUID for existing members, or an email for invites
// (the server resolves it via tenancy.resolveMemberSubject). PUT defines the
// member's single org role (ADR-0013), replacing other direct grants.
export function putOrgMemberMock(
  org: string,
  subject: string,
  body: { roleId: string },
): OrgMemberView {
  const members = (state.orgMembers[org] ??= []);
  const existing = members.find(
    (m) => m.userId === subject || m.email === subject,
  );
  if (existing) {
    existing.roles = [body.roleId];
    return existing;
  }
  const member: OrgMemberView = {
    userId: subject,
    displayName: subject,
    email: subject,
    roles: [body.roleId],
    teams: [],
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

// ---- M1.W2 role engine (ADR-0013) ----

export function permissionCatalog(): Permission[] {
  return PERMISSION_CATALOG;
}

// Built-ins are seeded per tenant; lazily seed for orgs created at runtime.
export function rolesFor(org: string): Role[] {
  return (state.roles[org] ??= builtinRoles(state.orgs[org]?.id ?? `t-${org}`));
}

export function findRole(org: string, nameOrId: string): Role | undefined {
  return rolesFor(org).find((r) => r.id === nameOrId || r.name === nameOrId);
}

export function createRoleMock(
  org: string,
  body: {
    name: string;
    displayName?: string;
    description?: string;
    permissions?: string[] | null;
  },
): Role {
  const roles = rolesFor(org);
  const created = new Date().toISOString();
  const role: Role = {
    id: nextId("role"),
    orgId: state.orgs[org]?.id ?? `t-${org}`,
    name: body.name,
    displayName: body.displayName ?? body.name,
    description: body.description ?? "",
    builtin: false,
    permissions: body.permissions ?? [],
    createdAt: created,
    updatedAt: created,
  };
  roles.push(role);
  return role;
}

// The tenant.admin guardrail (server: 409 + explanation): some team in the
// org must retain the tenant.admin permission after any role edit, or the
// tenant locks itself out.
function adminRetained(
  org: string,
  patched: { id: string; permissions: string[] | null },
): boolean {
  return teamsFor(org).some((team) => {
    const role = findRole(org, team.roleId);
    const permissions =
      role?.id === patched.id ? (patched.permissions ?? []) : (role?.permissions ?? []);
    return permissions.includes("tenant.admin");
  });
}

// Built-in names are immutable; the tenant.admin guardrail is enforced here
// (it needs the team→role state to answer 409).
export function updateRoleMock(
  org: string,
  nameOrId: string,
  patch: {
    name?: string;
    displayName?: string;
    description?: string;
    permissions?: string[];
  },
): Role | "builtin-rename" | "guardrail" | null {
  const role = findRole(org, nameOrId);
  if (!role) return null;
  if (role.builtin && patch.name !== undefined && patch.name !== role.name) {
    return "builtin-rename";
  }
  if (
    patch.permissions !== undefined &&
    !adminRetained(org, { id: role.id, permissions: patch.permissions })
  ) {
    return "guardrail";
  }
  if (patch.name !== undefined) role.name = patch.name;
  if (patch.displayName !== undefined) role.displayName = patch.displayName;
  if (patch.description !== undefined) role.description = patch.description;
  if (patch.permissions !== undefined) role.permissions = patch.permissions;
  role.updatedAt = new Date().toISOString();
  return role;
}

// Custom roles bound to teams cannot be deleted (server: 409, remap first).
export function deleteRoleMock(
  org: string,
  nameOrId: string,
): "ok" | "builtin" | "bound" | "not-found" {
  const role = findRole(org, nameOrId);
  if (!role) return "not-found";
  if (role.builtin) return "builtin";
  if (teamsFor(org).some((t) => t.roleId === role.id || t.roleId === role.name)) {
    return "bound";
  }
  state.roles[org] = rolesFor(org).filter((r) => r.id !== role.id);
  return "ok";
}

export function createTeamMock(org: string, name: string, roleId?: string): Team {
  const teams = (state.teams[org] ??= []);
  // Server default per CreateTeamInputBody: roleId defaults to viewer.
  const role = roleId || "viewer";
  const team: Team = {
    id: nextId("team"),
    orgId: state.orgs[org]?.id ?? `t-${org}`,
    name,
    displayName: name,
    roleId: role,
    roleName: role,
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

export function addTeamMemberMock(
  org: string,
  team: string,
  subject: string,
): boolean {
  if (!teamsFor(org).some((t) => t.name === team)) return false;
  const orgMember = orgMembersFor(org).find((m) => m.userId === subject);
  const member: MemberView = orgMember
    ? {
        userId: orgMember.userId,
        displayName: orgMember.displayName,
        email: orgMember.email,
        role: orgMember.roles?.[0] ?? "",
      }
    : {
        userId: subject,
        displayName: subject,
        email: "",
        role: "",
      };
  const members = (state.teamMembers[`${org}/${team}`] ??= []);
  if (!members.some((m) => m.userId === subject)) members.push(member);
  return true;
}

export function removeTeamMemberMock(
  org: string,
  team: string,
  subject: string,
): boolean {
  const key = `${org}/${team}`;
  const members = state.teamMembers[key] ?? [];
  const before = members.length;
  state.teamMembers[key] = members.filter((m) => m.userId !== subject);
  return state.teamMembers[key].length < before;
}

// ---- M1.W1 RBAC Phase A: platform admins + capability projection ----

// Server-side member search (?q= filters by email or display name,
// case-insensitive).
export function searchOrgMembers(org: string, q: string): OrgMemberView[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return orgMembersFor(org);
  return orgMembersFor(org).filter(
    (m) =>
      m.email.toLowerCase().includes(needle) ||
      m.displayName.toLowerCase().includes(needle),
  );
}

export function platformAdminsList(): MockPlatformAdmin[] {
  return state.platformAdmins.map((a) => ({ ...a }));
}

// subject is a Keycloak user id or an email (the server resolves emails via
// the Admin API); the mock stores whatever it is given.
export function grantPlatformAdminMock(subject: string): MockPlatformAdmin {
  const existing = state.platformAdmins.find(
    (a) => a.userId === subject || a.email === subject,
  );
  if (existing) return existing;
  const admin: MockPlatformAdmin = {
    userId: subject,
    email: subject.includes("@") ? subject : `${subject}@mock.local`,
    displayName: subject,
  };
  state.platformAdmins.push(admin);
  return admin;
}

export function revokePlatformAdminMock(subject: string): boolean {
  const before = state.platformAdmins.length;
  state.platformAdmins = state.platformAdmins.filter(
    (a) => a.userId !== subject && a.email !== subject,
  );
  return state.platformAdmins.length < before;
}

// Per-tenant capability projection for GET /me/permissions (tenants field).
export function tenantCapabilitiesProjection(): Record<
  string,
  Record<string, boolean>
> {
  return Object.fromEntries(
    Object.entries(state.tenantCapabilities).map(([org, caps]) => [
      org,
      { ...caps },
    ]),
  );
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

export function revokeRegistrationTokenMock(
  clusterId: string,
  tokenId: string,
): boolean {
  const tokens = state.registrationTokens[clusterId] ?? [];
  const before = tokens.length;
  state.registrationTokens[clusterId] = tokens.filter((t) => t.id !== tokenId);
  return state.registrationTokens[clusterId].length < before;
}

// ---- M6.W3: identity (OIDC clients / scopes) and approvals config ----

// Mirrors the server's built-in catalog (internal/config DefaultIdentityScopes).
export const oidcScopesCatalog: OidcScope[] = [
  { audience: "inari-server", scopes: ["read", "write"] },
  { audience: "inari-agent-gateway", scopes: ["connect"] },
  { audience: "inari-catalog", scopes: ["read", "deploy"] },
  { audience: "kubernetes", scopes: ["cluster"] },
];

export function oidcClientsFor(org: string): OidcClient[] {
  return state.oidcClients[org] ?? [];
}

export function findOidcClient(org: string, id: string): OidcClient | null {
  return oidcClientsFor(org).find((c) => c.clientId === id) ?? null;
}

export function createOidcClientMock(
  org: string,
  body: OidcClientInput,
): OidcClient {
  const clients = (state.oidcClients[org] ??= []);
  const client: OidcClient = {
    clientId: `org-${org}-${body.name}`,
    name: body.name,
    type: body.type ?? "service",
    audiences: body.audiences ?? [],
    redirectUris: body.redirectUris ?? [],
    scopes: body.scopes ?? [],
    status: "active",
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
  client.audiences = body.audiences ?? [];
  client.scopes = body.scopes ?? [];
  client.redirectUris = body.redirectUris ?? [];
  return client;
}

// DELETE disables server-side (row retained for audit); the list endpoint
// only returns active clients, so filter here.
export function deleteOidcClientMock(org: string, id: string): boolean {
  const clients = state.oidcClients[org] ?? [];
  const before = clients.length;
  state.oidcClients[org] = clients.filter((c) => c.clientId !== id);
  return state.oidcClients[org].length < before;
}

export function putClientScopesMock(
  org: string,
  id: string,
  scopes: string[],
): OidcClient | null {
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
  body: Pick<
    ApprovalConfig,
    "thresholds" | "approverGroups" | "autoApproveRules"
  >,
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

export function createSecretStoreMock(
  org: string,
  body: CreateSecretStoreInput,
): SecretStore {
  const stores = (state.secretStores[org] ??= []);
  const nowIso = new Date().toISOString();
  const store: SecretStore = {
    id: `ss-${body.name}`,
    name: body.name,
    orgId: org,
    scope: body.scope ?? "cluster",
    targets: body.targets ?? {},
    provider: body.provider,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  stores.push(store);
  return store;
}

export function updateSecretStoreMock(
  org: string,
  name: string,
  body: UpdateSecretStoreInput,
): SecretStore | null {
  const store = findSecretStore(org, name);
  if (!store) return null;
  if (body.provider) store.provider = body.provider;
  if (body.targets) store.targets = body.targets;
  store.updatedAt = new Date().toISOString();
  return store;
}

export function deleteSecretStoreMock(org: string, name: string): boolean {
  const stores = state.secretStores[org] ?? [];
  const before = stores.length;
  state.secretStores[org] = stores.filter((s) => s.name !== name);
  return state.secretStores[org].length < before;
}

export function secretStoreStatusFor(
  org: string,
  name: string,
): SecretStoreStatus | null {
  const store = findSecretStore(org, name);
  if (!store) return null;
  const clusterId = store.targets.clusterIds?.[0] ?? "*";
  if (store.scope === "platform") {
    return {
      delivered: true,
      conditions: [
        {
          clusterId,
          type: "Ready",
          status: "True",
          reason: "Reconciled",
        },
      ],
    };
  }
  return {
    delivered: false,
    conditions: [
      {
        clusterId,
        type: "Ready",
        status: "False",
        reason: "WaitingForAgent",
        message: "Waiting for the cluster agent to reconcile the SecretStore.",
      },
    ],
  };
}

// ---- M6.W6: IdP brokering + login-routing domains ----

export function idpProviderFor(org: string): OidcProvider | null {
  return state.idpProviders[org] ?? null;
}

export function putIdpProviderMock(
  org: string,
  body: OidcProviderInput,
): OidcProvider {
  const existing = state.idpProviders[org];
  const provider: OidcProvider = {
    alias: body.alias,
    claimMapping: body.claimMapping ?? {},
    clientId: body.clientId,
    domainHints: body.domainHints ?? [],
    issuerUrl: body.issuerUrl,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  for (const d of existing?.domainHints ?? []) delete state.claimedDomains[d];
  state.idpProviders[org] = provider;
  for (const d of provider.domainHints ?? []) state.claimedDomains[d] = org;
  return provider;
}

export function rotateIdpSecretMock(
  org: string,
  clientSecret: string,
): OidcProvider | null {
  const provider = state.idpProviders[org];
  if (!provider || !clientSecret) return null;
  // The secret is write-only: rotation leaves no readable trace on the
  // provider projection.
  return provider;
}

export function deleteIdpProviderMock(org: string): boolean {
  const provider = state.idpProviders[org];
  if (!provider) return false;
  for (const d of provider.domainHints ?? []) delete state.claimedDomains[d];
  delete state.idpProviders[org];
  return true;
}

// Returns the conflicting domain when another org has claimed it.
export function domainClaimConflict(
  org: string,
  domainHints: string[],
): string | null {
  for (const d of domainHints) {
    const claimant = state.claimedDomains[d];
    if (claimant && claimant !== org) return d;
  }
  return null;
}

export function putDomainHintsMock(
  org: string,
  domainHints: string[],
): OidcProvider | null {
  const provider = state.idpProviders[org];
  if (!provider) return null;
  for (const d of provider.domainHints ?? []) delete state.claimedDomains[d];
  provider.domainHints = domainHints;
  for (const d of domainHints) state.claimedDomains[d] = org;
  return provider;
}


// ---- Notification endpoints (inari-server internal/notifications) ----

export interface NotificationEndpointInput {
  name?: string;
  kind?: string;
  url?: string;
  secret?: string;
  events?: string[] | null;
  enabled?: boolean;
}

export function notificationEndpointsFor(org: string): NotificationEndpoint[] {
  return state.notificationEndpoints[org] ?? [];
}

export function findNotificationEndpoint(
  org: string,
  id: string,
): NotificationEndpoint | null {
  return notificationEndpointsFor(org).find((e) => e.id === id) ?? null;
}

export function createNotificationEndpointMock(
  org: string,
  body: NotificationEndpointInput,
): NotificationEndpoint {
  const endpoints = (state.notificationEndpoints[org] ??= []);
  const endpoint: NotificationEndpoint = {
    id: nextId("ne"),
    orgId: org,
    name: body.name ?? "",
    kind: body.kind ?? "webhook",
    url: body.url ?? "",
    events: body.events ?? null,
    enabled: body.enabled ?? true,
    createdAt: new Date().toISOString(),
  };
  endpoints.push(endpoint);
  return endpoint;
}

export function updateNotificationEndpointMock(
  org: string,
  id: string,
  body: NotificationEndpointInput,
): NotificationEndpoint | null {
  const endpoint = findNotificationEndpoint(org, id);
  if (!endpoint) return null;
  if (body.name !== undefined) endpoint.name = body.name;
  if (body.url !== undefined) endpoint.url = body.url;
  if (body.events !== undefined) endpoint.events = body.events;
  if (body.enabled !== undefined) endpoint.enabled = body.enabled;
  return endpoint;
}

export function deleteNotificationEndpointMock(
  org: string,
  id: string,
): boolean {
  const endpoints = state.notificationEndpoints[org] ?? [];
  const before = endpoints.length;
  state.notificationEndpoints[org] = endpoints.filter((e) => e.id !== id);
  return state.notificationEndpoints[org].length < before;
}
