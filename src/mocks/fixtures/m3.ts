import type { CloudAccount, ProviderConfig, TrustSnippet, ValidationResult } from "@/api/cloud-accounts";
import type { ApprovalRequest } from "@/api/approvals";
import type { AuditEvent } from "@/api/audit";
import type { RbacMatrix } from "@/api/rbac";
import type { TenantPlatformResource } from "@/api/platform";
import type { CreateZoneRequest, TenantZone, ZoneStep } from "@/api/zones";

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
  const names: ZoneStep["name"][] = ["account", "trust", "eks", "wiring"];
  return names.map((name, i) => ({
    name,
    status:
      name === failedStep
        ? "failed"
        : i < done
          ? "done"
          : i === done
            ? "in_progress"
            : "pending",
    message:
      name === failedStep
        ? "EKS cluster creation hit service quota; requesting increase"
        : null,
  }));
}

function seedState(): M3State {
  return {
    accounts: [
      {
        id: "ca-acme-prod",
        tenant: "acme",
        provider: "aws",
        name: "acme-prod",
        accountId: "123456789012",
        roleArn: "arn:aws:iam::123456789012:role/inari-platform-access",
        externalId: "inari-acme-ca-acme-prod",
        regions: ["eu-west-1", "eu-central-1"],
        status: "connected",
        statusMessage: null,
        providerConfigName: "aws-acme-prod",
        lastValidatedAt: iso(now - 3_600_000),
        createdAt: iso(now - 14 * 86_400_000),
      },
      {
        id: "ca-acme-sandbox",
        tenant: "acme",
        provider: "aws",
        name: "acme-sandbox",
        accountId: "210987654321",
        roleArn: "arn:aws:iam::210987654321:role/inari-platform-access",
        externalId: "inari-acme-ca-acme-sandbox",
        regions: ["eu-west-1"],
        status: "pending_trust",
        statusMessage: null,
        providerConfigName: null,
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
        description: "Requested by team developers; item requires platform-admin approval.",
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
        description: "Starter tier zone in eu-west-1 under OU acme-data.",
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
        description: "Requested by me.",
        requestedBy: "me@inari.dev",
        requestedAt: iso(now - 3 * 86_400_000),
        status: "rejected",
        decidedBy: "platform-admin@inari.dev",
        decidedAt: iso(now - 2 * 86_400_000),
        decisionReason: "Use the platform-managed ingress instead.",
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
        steps: zoneSteps(4),
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
  body: { name: string; accountId: string; regions: string[] },
): CloudAccount {
  const account: CloudAccount = {
    id: `ca-${tenant}-${body.name}`,
    tenant,
    provider: "aws",
    name: body.name,
    accountId: body.accountId,
    roleArn: `arn:aws:iam::${body.accountId}:role/inari-platform-access`,
    externalId: `inari-${tenant}-ca-${tenant}-${body.name}`,
    regions: body.regions,
    status: "pending_trust",
    statusMessage: null,
    providerConfigName: null,
    lastValidatedAt: null,
    createdAt: new Date().toISOString(),
  };
  state.accounts.push(account);
  return account;
}

export function trustSnippetFor(account: CloudAccount): TrustSnippet {
  const issuerUrl = "https://oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER";
  const sub = `system:serviceaccount:inari-system:crossplane-provider-aws`;
  const trustPolicy = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Federated: "arn:aws:iam::999988887777:oidc-provider/oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER" },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              "oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER:sub": sub,
              "oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER:aud": "sts.amazonaws.com",
            },
          },
        },
        {
          Effect: "Allow",
          Principal: { AWS: "arn:aws:iam::999988887777:role/inari-control-plane" },
          Action: "sts:AssumeRole",
          Condition: { StringEquals: { "sts:ExternalId": account.externalId } },
        },
      ],
    },
    null,
    2,
  );
  return {
    oidcProviderArn:
      "arn:aws:iam::999988887777:oidc-provider/oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER",
    issuerUrl,
    audience: "sts.amazonaws.com",
    subject: sub,
    externalId: account.externalId,
    cloudformation: [
      "AWSTemplateFormatVersion: '2010-09-09'",
      "Description: One-time trust setup for Inari platform access",
      "Resources:",
      "  InariPlatformAccessRole:",
      "    Type: AWS::IAM::Role",
      "    Properties:",
      "      RoleName: inari-platform-access",
      "      AssumeRolePolicyDocument: |",
      ...trustPolicy.split("\n").map((l) => `        ${l}`),
      "      ManagedPolicyArns:",
      "        - arn:aws:iam::aws:policy/PowerUserAccess",
      "Outputs:",
      "  RoleArn:",
      "    Value: !GetAtt InariPlatformAccessRole.Arn",
      "",
    ].join("\n"),
    terraform: [
      'resource "aws_iam_role" "inari_platform_access" {',
      '  name = "inari-platform-access"',
      "  assume_role_policy = jsonencode(",
      ...trustPolicy.split("\n").map((l) => `    ${l}`),
      "  )",
      "}",
      "",
    ].join("\n"),
  };
}

export function validateAccount(id: string): ValidationResult | undefined {
  const account = findAccount(id);
  if (!account) return undefined;
  const count = (state.validateCount[id] = (state.validateCount[id] ?? 0) + 1);
  // First validation attempt fails in the mock so the retry path is visible;
  // the second succeeds and connects the account.
  if (count === 1) {
    account.status = "failed";
    account.statusMessage =
      "AssumeRole denied: role arn:aws:iam::*:role/inari-platform-access not found or trust policy missing";
    return {
      status: "failed",
      message: account.statusMessage,
      providerConfigName: null,
      checkedAt: new Date().toISOString(),
    };
  }
  account.status = "connected";
  account.statusMessage = null;
  account.providerConfigName = `aws-${account.tenant}-${account.name}`;
  account.lastValidatedAt = new Date().toISOString();
  return {
    status: "ok",
    message: "Dry-run AssumeRole succeeded; ProviderConfig created",
    providerConfigName: account.providerConfigName,
    checkedAt: account.lastValidatedAt,
  };
}

export function listProviderConfigs(tenant: string): ProviderConfig[] {
  return state.accounts
    .filter((a) => a.providerConfigName && (a.tenant === tenant || tenant === "all"))
    .map((a) => ({
      name: a.providerConfigName!,
      kind: "ProviderConfig (provider-aws)",
      health: a.status === "connected" ? "healthy" : "unknown",
      accountId: a.accountId,
      createdAt: a.createdAt,
    }));
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

// ---- approvals ----

export function listApprovalsFor(
  tenant: string,
  view: "inbox" | "requested",
): ApprovalRequest[] {
  return state.approvals.filter((a) => {
    if (a.tenant !== tenant && tenant !== "all") return false;
    if (view === "requested") return a.requestedBy === "me@inari.dev";
    return a.requestedBy !== "me@inari.dev" || a.status !== "pending";
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

export function findZone(id: string): TenantZone | undefined {
  return state.zones.find((z) => z.id === id);
}

export function createZoneMock(tenant: string, body: CreateZoneRequest): TenantZone {
  const zone: TenantZone = {
    id: `zn-${tenant}-${body.slug}`,
    tenant,
    name: body.name,
    slug: body.slug,
    orgUnit: body.orgUnit,
    region: body.region,
    tier: "starter",
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
  const zone = findZone(id);
  if (!zone) return undefined;
  zone.updatedAt = new Date().toISOString();
  if (zone.status === "provisioning") {
    const idx = zone.steps.findIndex((s) => s.status === "in_progress");
    if (idx === -1) {
      const first = zone.steps.find((s) => s.status === "pending");
      if (first) first.status = "in_progress";
    } else {
      zone.steps[idx].status = "done";
      const next = zone.steps[idx + 1];
      if (next) next.status = "in_progress";
    }
    if (zone.steps.every((s) => s.status === "done")) {
      zone.status = "active";
      zone.cloudAccountId = `ca-${zone.tenant}-${zone.slug}`;
      zone.clusterId = `cl-${zone.slug}`;
    }
  } else if (zone.status === "decommissioning") {
    const lastDone = zone.steps.map((s) => s.status).lastIndexOf("done");
    if (lastDone === -1) {
      zone.status = "decommissioned";
    } else {
      zone.steps[lastDone].status = "pending";
    }
  }
  return zone;
}

export function requestDecommissionMock(id: string, reason: string): TenantZone | undefined {
  const zone = findZone(id);
  if (!zone || zone.status !== "active") return undefined;
  zone.status = "decommission_requested";
  zone.updatedAt = new Date().toISOString();
  const approval: ApprovalRequest = {
    id: `ap-decom-${zone.id}`,
    tenant: zone.tenant,
    kind: "zone-decommission",
    title: `Decommission tenant zone ${zone.slug}`,
    description: reason,
    requestedBy: "me@inari.dev",
    requestedAt: new Date().toISOString(),
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
  };
  state.approvals.push(approval);
  return zone;
}
