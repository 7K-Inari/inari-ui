import type { CloudAccount } from "@/api/cloud-accounts";
import type { ApprovalRequest } from "@/api/approvals";
import type { AuditEvent } from "@/api/audit";
import type { RbacMatrix } from "@/api/rbac";
import type { TenantPlatformResource } from "@/api/platform";
import type { CreateZoneRequest, TenantZone, ZoneStep, ZoneStepName } from "@/api/zones";

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

interface M3State {
  accounts: CloudAccount[];
  approvals: ApprovalRequest[];
  audit: AuditEvent[];
  rbac: Record<string, { groupPath: string; clusterRole: string }[]>;
  platformResources: TenantPlatformResource[];
  zones: TenantZone[];
  validateCount: Record<string, number>;
}

function seedRbac(tenant: string) {
  return [
    { groupPath: `tenant-${tenant}/platform-team`, clusterRole: `tenant-${tenant}-operator` },
    { groupPath: `tenant-${tenant}/developers`, clusterRole: `tenant-${tenant}-viewer` },
  ];
}

function zoneSteps(done: number, failedStep?: string): ZoneStep[] {
  const names: ZoneStepName[] = [
    "preflight",
    "account_vend",
    "trust_bootstrap",
    "eks_provision",
    "inari_wiring",
  ];
  return names.map((name, i) => ({
    name,
    status:
      name === failedStep
        ? "failed"
        : i < done
          ? "succeeded"
          : i === done
            ? "running"
            : "pending",
    attempts: name === failedStep ? 3 : 1,
    detail:
      name === failedStep
        ? "EKS cluster creation hit service quota; requesting increase"
        : null,
    externalRef: null,
    updatedAt: iso(now),
  }));
}

function seedState(): M3State {
  return {
    accounts: [
      {
        id: "ca-acme-prod",
        tenant: "acme",
        provider: "aws",
        accountId: "123456789012",
        roleArn: "arn:aws:iam::123456789012:role/inari-platform-access",
        externalId: "inari-acme-123456789012",
        issuerUrl: "https://oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER",
        status: "connected",
        statusMessage: null,
        lastValidatedAt: iso(now - 3_600_000),
        createdAt: iso(now - 14 * 86_400_000),
      },
      {
        id: "ca-acme-sandbox",
        tenant: "acme",
        provider: "aws",
        accountId: "210987654321",
        roleArn: "arn:aws:iam::210987654321:role/inari-platform-access",
        externalId: "inari-acme-210987654321",
        issuerUrl: "https://oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER",
        status: "pending_trust",
        statusMessage: null,
        lastValidatedAt: null,
        createdAt: iso(now - 86_400_000),
      },
    ],
    approvals: [
      {
        id: "ap-1",
        tenant: "acme",
        kind: "deploy",
        title: "Deploy postgresql-aws 16.3 to eks-prod-eu",
        requestedBy: "jane@acme.example",
        requestedAt: iso(now - 7_200_000),
        status: "pending",
        decidedBy: null,
        decidedAt: null,
        decisionReason: null,
      },
      {
        id: "ap-2",
        tenant: "acme",
        kind: "zone-vend",
        title: "Vend tenant zone acme-analytics",
        requestedBy: "me@inari.dev",
        requestedAt: iso(now - 2 * 86_400_000),
        status: "approved",
        decidedBy: "platform-admin@inari.dev",
        decidedAt: iso(now - 86_400_000),
        decisionReason: "Quota available; OU already governed.",
      },
      {
        id: "ap-3",
        tenant: "acme",
        kind: "deploy",
        title: "Deploy nginx-ingress to kind-dev",
        requestedBy: "me@inari.dev",
        requestedAt: iso(now - 3 * 86_400_000),
        status: "rejected",
        decidedBy: "platform-admin@inari.dev",
        decidedAt: iso(now - 2 * 86_400_000),
        decisionReason: "Use the platform-managed ingress instead.",
      },
      {
        id: "ap-4",
        tenant: "globex",
        kind: "deploy",
        title: "Deploy redis-cache to gke-staging",
        requestedBy: "joe@globex.example",
        requestedAt: iso(now - 3_600_000),
        status: "pending",
        decidedBy: null,
        decidedAt: null,
        decisionReason: null,
      },
    ],
    audit: [
      {
        id: "ae-1",
        tenant: "acme",
        actor: "jane@acme.example",
        action: "deploy.create",
        objectType: "instance",
        objectName: "pg-orders",
        detail: "Requested postgresql-aws 16.3 (pending approval)",
        at: iso(now - 7_200_000),
      },
      {
        id: "ae-2",
        tenant: "acme",
        actor: "platform-admin@inari.dev",
        action: "approval.decide",
        objectType: "approval",
        objectName: "ap-2",
        detail: "Approved zone vend acme-analytics",
        at: iso(now - 86_400_000),
      },
      {
        id: "ae-3",
        tenant: "acme",
        actor: "me@inari.dev",
        action: "cloud-account.validate",
        objectType: "cloud-account",
        objectName: "acme-prod",
        detail: "Dry-run AssumeRole succeeded",
        at: iso(now - 3_600_000),
      },
      {
        id: "ae-4",
        tenant: "globex",
        actor: "ops@globex.example",
        action: "cluster.register",
        objectType: "cluster",
        objectName: "gke-staging",
        detail: "Cluster registered",
        at: iso(now - 7 * 86_400_000),
      },
    ],
    rbac: {
      acme: seedRbac("acme"),
      globex: seedRbac("globex"),
    },
    platformResources: [
      {
        id: "pr-realm-acme",
        tenant: "acme",
        kind: "keycloak-realm",
        name: "acme",
        status: "ready",
        detail: "Realm acme in platform Keycloak; 2 clients, 4 groups",
        updatedAt: iso(now - 3_600_000),
      },
      {
        id: "pr-client-acme-console",
        tenant: "acme",
        kind: "keycloak-client",
        name: "acme-console",
        status: "ready",
        detail: "OIDC client for the console (audience acme)",
        updatedAt: iso(now - 3_600_000),
      },
      {
        id: "pr-dns-acme",
        tenant: "acme",
        kind: "dns-zone",
        name: "acme.apps.inari.dev",
        status: "ready",
        detail: "Route53 hosted zone delegated from apps.inari.dev",
        updatedAt: iso(now - 86_400_000),
      },
      {
        id: "pr-ns-acme-team",
        tenant: "acme",
        kind: "tenant-namespace",
        name: "tenant-acme",
        status: "reconciling",
        detail: "inari-operator applying namespace baseline policies",
        updatedAt: iso(now - 600_000),
      },
    ],
    zones: [
      {
        id: "zn-acme-core",
        tenant: "acme",
        name: "acme-core",
        slug: "acme-core",
        orgUnit: "acme-workloads",
        region: "eu-west-1",
        tier: "starter",
        status: "active",
        steps: zoneSteps(5),
        cloudAccountId: "ca-acme-prod",
        clusterId: "cl-eks-prod",
        createdAt: iso(now - 30 * 86_400_000),
        updatedAt: iso(now - 30 * 86_400_000),
      },
      {
        id: "zn-acme-analytics",
        tenant: "acme",
        name: "acme-analytics",
        slug: "acme-analytics",
        orgUnit: "acme-data",
        region: "eu-west-1",
        tier: "starter",
        status: "provisioning",
        steps: zoneSteps(3),
        cloudAccountId: null,
        clusterId: null,
        createdAt: iso(now - 2 * 86_400_000),
        updatedAt: iso(now - 1_800_000),
      },
    ],
    validateCount: {},
  };
}

let state: M3State = seedState();

export const m3MockControl = {
  reset() {
    state = seedState();
  },
};

// ---- cloud accounts ----

export function listAccounts(tenant: string): CloudAccount[] {
  return state.accounts.filter((a) => a.tenant === tenant || tenant === "all");
}

export function findAccount(id: string): CloudAccount | undefined {
  return state.accounts.find((a) => a.id === id);
}

export function createAccount(
  tenant: string,
  body: { accountId: string; roleArn: string; externalId?: string },
): CloudAccount {
  const account: CloudAccount = {
    id: `ca-${tenant}-${body.accountId}`,
    tenant,
    provider: "aws",
    accountId: body.accountId,
    roleArn: body.roleArn,
    externalId: body.externalId ?? `inari-${tenant}-${body.accountId}`,
    issuerUrl: "https://oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER",
    status: "pending_trust",
    statusMessage: null,
    lastValidatedAt: null,
    createdAt: new Date().toISOString(),
  };
  state.accounts.push(account);
  return account;
}

export function validateAccount(id: string): CloudAccount | undefined {
  const account = findAccount(id);
  if (!account) return undefined;
  const count = (state.validateCount[id] = (state.validateCount[id] ?? 0) + 1);
  // First validation attempt fails in the mock so the retry path is visible;
  // the second succeeds and connects the account.
  if (count === 1) {
    account.status = "failed";
    account.statusMessage =
      "AssumeRole denied: role not found or trust policy missing ExternalId condition";
    return account;
  }
  account.status = "connected";
  account.statusMessage = null;
  account.lastValidatedAt = new Date().toISOString();
  return account;
}

// Renders the Crossplane ProviderConfig manifest for a cluster, mirroring
// GET /tenants/{org}/cloud-accounts/{id}/providerconfig (plain-text body).
export function providerConfigManifestFor(account: CloudAccount, clusterId: string): string {
  const name = `aws-${account.tenant}-${account.accountId}`;
  return [
    "apiVersion: aws.upbound.io/v1beta1",
    "kind: ProviderConfig",
    "metadata:",
    `  name: ${name}`,
    "spec:",
    "  credentials:",
    "    source: WebIdentity",
    "    webIdentity:",
    `      roleARN: ${account.roleArn}`,
    `      clusterID: ${clusterId}`,
    ...(account.externalId ? [`      externalID: ${account.externalId}`] : []),
    "",
  ].join("\n");
}

// ---- rbac ----

export function rbacMatrixFor(tenant: string): RbacMatrix {
  return {
    groups: [
      { path: `tenant-${tenant}/platform-team`, team: "platform-team", memberCount: 3 },
      { path: `tenant-${tenant}/developers`, team: "developers", memberCount: 12 },
      { path: `tenant-${tenant}/data`, team: "data", memberCount: 5 },
    ],
    roles: [
      {
        name: `tenant-${tenant}-operator`,
        kind: "operator",
        description: "Full manage rights on tenant-scoped namespaces and resources",
      },
      {
        name: `tenant-${tenant}-viewer`,
        kind: "viewer",
        description: "Read-only access to tenant namespaces and resources",
      },
    ],
    mappings: (state.rbac[tenant] ?? []).map((m) => ({ ...m })),
  };
}

export function setRbacMappingMock(
  tenant: string,
  groupPath: string,
  clusterRole: string,
  mapped: boolean,
): void {
  const list = (state.rbac[tenant] = state.rbac[tenant] ?? []);
  const idx = list.findIndex((m) => m.groupPath === groupPath && m.clusterRole === clusterRole);
  if (mapped && idx === -1) list.push({ groupPath, clusterRole });
  if (!mapped && idx !== -1) list.splice(idx, 1);
}

// Declarative whole-set replace (M6.W3 settings editor).
export function setRbacMappingsMock(
  tenant: string,
  mappings: { groupPath: string; clusterRole: string }[],
): void {
  state.rbac[tenant] = mappings.map((m) => ({ ...m }));
}

// ---- approvals ----

export function listApprovalsFor(
  tenant: string,
  q: { requester?: string | null; state?: string | null },
): ApprovalRequest[] {
  return state.approvals.filter((a) => {
    if (a.tenant !== tenant && tenant !== "all") return false;
    // requester=me returns the caller's own requests ("requested" tab).
    if (q.requester === "me") return a.requestedBy === "me@inari.dev";
    // Default (no filter) and state=pending both mean the inbox: pending
    // requests awaiting someone else's decision.
    if (!q.state || q.state === "pending") {
      return a.status === "pending" && a.requestedBy !== "me@inari.dev";
    }
    return a.status === q.state;
  });
}

export function decideApprovalMock(
  id: string,
  decision: "approve" | "reject",
  reason: string,
): ApprovalRequest | undefined {
  const approval = state.approvals.find((a) => a.id === id);
  if (!approval || approval.status !== "pending") return undefined;
  approval.status = decision === "approve" ? "approved" : "rejected";
  approval.decidedBy = "me@inari.dev";
  approval.decidedAt = new Date().toISOString();
  approval.decisionReason = reason;
  return approval;
}

// ---- audit ----

export interface AuditQuery {
  actor?: string;
  action?: string;
  objectType?: string;
  from?: string;
  to?: string;
}

export function listAuditFor(tenant: string, q: AuditQuery): AuditEvent[] {
  return state.audit.filter((e) => {
    if (e.tenant !== tenant && tenant !== "all") return false;
    if (q.actor && !e.actor.includes(q.actor)) return false;
    if (q.action && e.action !== q.action) return false;
    if (q.objectType && e.objectType !== q.objectType) return false;
    if (q.from && e.at < q.from) return false;
    if (q.to && e.at > q.to) return false;
    return true;
  });
}

export function auditCsv(events: AuditEvent[]): string {
  const rows = events.map((e) =>
    [e.at, e.tenant, e.actor, e.action, e.objectType, e.objectName, `"${e.detail.replaceAll('"', '""')}"`].join(","),
  );
  return ["at,tenant,actor,action,objectType,objectName,detail", ...rows].join("\n");
}

// ---- platform ----

export function listPlatformResources(tenant: string): TenantPlatformResource[] {
  return state.platformResources.filter((r) => r.tenant === tenant || tenant === "all");
}

// ---- zones ----

export function listZonesFor(tenant: string): TenantZone[] {
  return state.zones.filter((z) => z.tenant === tenant || tenant === "all");
}

function findZoneState(id: string): TenantZone | undefined {
  return state.zones.find((z) => z.id === id);
}

// Huma server wire aliases layered onto the view-model zone. Tests can pin a
// handler that serves findZone() directly as the {zone: ...} envelope (bypass
// toServerZone), so the returned object must already speak the wire shape.
type ServerZoneAliases = {
  orgId: string;
  ownerOrgId: string;
  displayName: string;
  ouId: string;
  state: string;
};

export function findZone(id: string): (TenantZone & ServerZoneAliases) | undefined {
  const z = findZoneState(id);
  if (!z) return undefined;
  return {
    ...z,
    orgId: z.tenant,
    ownerOrgId: z.tenant,
    displayName: z.name,
    ouId: z.orgUnit,
    state: z.status,
  };
}

export function createZoneMock(tenant: string, body: CreateZoneRequest): TenantZone {
  const zone: TenantZone = {
    id: `zn-${tenant}-${body.slug}`,
    tenant,
    name: body.displayName,
    slug: body.slug,
    orgUnit: body.ouId,
    region: body.region,
    tier: body.tier,
    status: "provisioning",
    steps: zoneSteps(0),
    cloudAccountId: null,
    clusterId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.zones.push(zone);
  return zone;
}

// Poll-driven progression: each poll advances the pipeline one step so the
// lifecycle view animates in dev/mock mode.
export function pollZoneMock(id: string): TenantZone | undefined {
  const zone = findZoneState(id);
  if (!zone) return undefined;
  zone.updatedAt = new Date().toISOString();
  if (zone.status === "provisioning") {
    const idx = zone.steps.findIndex((s) => s.status === "running");
    if (idx === -1) {
      const first = zone.steps.find((s) => s.status === "pending");
      if (first) first.status = "running";
    } else {
      zone.steps[idx].status = "succeeded";
      const next = zone.steps[idx + 1];
      if (next) next.status = "running";
    }
    if (zone.steps.every((s) => s.status === "succeeded")) {
      zone.status = "active";
      zone.cloudAccountId = `ca-${zone.tenant}-${zone.slug}`;
      zone.clusterId = `cl-${zone.slug}`;
    }
  } else if (zone.status === "decommissioning") {
    const lastDone = zone.steps.map((s) => s.status).lastIndexOf("succeeded");
    if (lastDone === -1) {
      zone.status = "closed";
    } else {
      zone.steps[lastDone].status = "pending";
    }
  }
  return zone;
}

export function requestDecommissionMock(id: string): ApprovalRequest | undefined {
  const zone = findZoneState(id);
  if (!zone || zone.status !== "active") return undefined;
  // Server transitions the zone to decommission_pending_approval and returns
  // the approval id; the approval record itself carries the operator context.
  zone.status = "decommission_pending_approval";
  zone.updatedAt = new Date().toISOString();
  const approval: ApprovalRequest = {
    id: `ap-decom-${zone.id}`,
    tenant: zone.tenant,
    kind: "zone-decommission",
    title: `Decommission tenant zone ${zone.slug}`,
    requestedBy: "me@inari.dev",
    requestedAt: new Date().toISOString(),
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
  };
  state.approvals.push(approval);
  return approval;
}
