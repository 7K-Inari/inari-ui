import { http, HttpResponse } from "msw";

import {
  capabilitiesFor,
  findCluster,
  listForTenant,
  registerCluster,
  removeCluster,
} from "@/mocks/fixtures";
import {
  createDeployMock,
  findCatalogItem,
  findResource,
  instanceViewForDeploy,
  listCatalogItemsFiltered,
  listResourcesForTenant,
  pollDeployMock,
  upgradeDiffFor,
  upgradeResourceMock,
} from "@/mocks/fixtures/catalog";
import type { ApprovalRequest } from "@/api/approvals";
import type { CloudAccount } from "@/api/cloud-accounts";
import type { CreateClusterRequest } from "@/api/clusters";
import type { AgentChannel } from "@/api/fleet";
import type { TenantZone } from "@/api/zones";
import type {
  ClusterSummary,
  ClusterDetail,
  CreateDeployRequest,
  Deploy,
} from "@/api/types";
import {
  auditCsv,
  createAccount,
  createZoneMock,
  decideApprovalMock,
  findAccount,
  listAccounts,
  listApprovalsFor,
  listAuditFor,
  listPlatformResources,
  listZonesFor,
  pollZoneMock,
  providerConfigManifestFor,
  rbacMatrixFor,
  requestDecommissionMock,
  setRbacMappingMock,
  validateAccount,
} from "@/mocks/fixtures/m3";

import {
  addUiExtensionMock,
  createClusterSetMock,
  createScaffoldMock,
  deleteClusterSetMock,
  findTemplateMock,
  getClusterSetMock,
  getRolloutMock,
  listAgentChannelMocks,
  listBackendExtensionMocks,
  listClusterSetMembersMock,
  listClusterSetMocks,
  listDriftMocks,
  listRolloutMocks,
  listRolloutTargetsMock,
  listTemplateMocks,
  listUiExtensionMocks,
  pollRolloutMock,
  pollScaffoldMock,
  removeUiExtensionMock,
  rollbackRolloutMock,
  selfExtensionPermissions,
  setAgentChannelMock,
} from "@/mocks/fixtures/m4";

// Handlers mirror the real inari-server REST surface: tenant slug in the
// path (/api/v1/tenants/{org}/...) and wrapped response envelopes
// ({cluster}, {clusters}, {items}, {instances}, {deploy}, ...).
const BASE = "*/api/v1/tenants/:org";

/* eslint-disable @typescript-eslint/no-explicit-any */

function toServerCluster(c: ClusterSummary | ClusterDetail) {
  return {
    id: c.id,
    orgId: c.tenant,
    name: c.name,
    kubernetesVersion: c.k8sVersion,
    labels: c.labels,
    state:
      c.status === "connected"
        ? "active"
        : c.status === "pending"
          ? "pending_registration"
          : c.status,
    lastSeenAt: c.lastSeenAt,
    createdAt: c.createdAt,
  };
}

// ---- M3: cloud accounts (huma CloudAccount wire shape) ----

// Orgs the mock caller belongs to; matches the tenants used by the cluster
// and m3 fixtures (acme, globex) so cross-tenant pages fan out over both.
function seededOrganizations() {
  return [
    {
      id: "t-acme",
      slug: "acme",
      displayName: "Acme Corp",
      keycloakOrgId: "kc-acme",
      createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    },
    {
      id: "t-globex",
      slug: "globex",
      displayName: "Globex Inc",
      keycloakOrgId: "kc-globex",
      createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    },
  ];
}

function toServerCloudAccount(a: CloudAccount) {
  return {
    id: a.id,
    orgId: a.tenant,
    provider: a.provider,
    accountId: a.accountId,
    roleArn: a.roleArn,
    externalId: a.externalId,
    state: a.status,
    validationError: a.statusMessage ?? undefined,
    validatedAt: a.lastValidatedAt ?? undefined,
    issuerUrl: "https://oidc.eks.eu-west-1.amazonaws.com/id/PLATFORMCLUSTER",
    runContext: "tenant",
    createdBy: "me@inari.dev",
    createdAt: a.createdAt,
  };
}

// ---- M3: approvals (huma ApprovalRequest wire shape) ----

function toServerApproval(a: ApprovalRequest) {
  return {
    id: a.id,
    orgId: a.tenant,
    action: a.kind,
    name: a.title,
    requester: a.requestedBy,
    createdAt: a.requestedAt,
    state: a.status,
    approver: a.decidedBy ?? undefined,
    decidedAt: a.decidedAt ?? undefined,
    reason: a.decisionReason ?? undefined,
    clusterId: "",
    itemId: "",
    version: "",
    spec: {},
  };
}

// ---- M3: tenant zones (huma TenantZone wire shape) ----

function toServerZone(z: TenantZone) {
  return {
    id: z.id,
    orgId: z.tenant,
    ownerOrgId: z.tenant,
    displayName: z.name,
    slug: z.slug,
    ouId: z.orgUnit,
    region: z.region,
    tier: z.tier,
    state: z.status,
    cloudAccountId: z.cloudAccountId ?? undefined,
    clusterId: z.clusterId ?? undefined,
    managementAccountId: "ma-platform-prod",
    createdBy: "me@inari.dev",
    createdAt: z.createdAt,
    updatedAt: z.updatedAt,
  };
}

// GetZoneOutputBody carries the provisioning steps as a TenantZoneStep map
// alongside the zone (the zone summary itself embeds no steps).
function toServerZoneSteps(z: TenantZone) {
  return Object.fromEntries(
    z.steps.map((s) => [
      s.name,
      {
        zoneId: z.id,
        step: s.name,
        status: s.status,
        attempts: s.attempts,
        detail: s.detail ?? undefined,
        externalRef: s.externalRef ?? undefined,
        updatedAt: s.updatedAt,
      },
    ]),
  );
}

// ---- M4: fleet (huma ClusterSet/Rollout/RolloutTarget/DriftEvent/AgentChannel shapes) ----

// Fleet fixtures in m4.ts already speak the huma wire shapes, so handlers
// wrap them in the response envelopes without further mapping.

function toServerItem(i: any) {
  // Catalog fixtures already speak the huma ItemView wire shape.
  return i;
}

function toServerInstance(r: any) {
  // Instance fixtures already speak the huma InstanceView wire shape.
  return r;
}

function toServerDeployResult(d: Deploy) {
  // DeployResult is a Go-style struct in the huma spec: PascalCase fields.
  return {
    InstanceID: d.instanceId ?? d.id,
    Version: d.version,
    Status: d.phase === "pending" ? "pending_approval" : "deploying",
    CommitSHA: "",
    PRURL: d.prUrl ?? "",
    ApprovalID: "",
  };
}

function humaError(status: number, detail: string) {
  return HttpResponse.json({ title: "Error", status, detail }, { status });
}

export const handlers = [
  // ---- global permissions (OpenFGA projection, M1.W2) ----
  http.get("*/api/v1/me/permissions", () =>
    HttpResponse.json({ canCreateOrganizations: true }),
  ),

  // ---- tenants (platform-scoped, not under /tenants/:org) ----
  http.get("*/api/v1/tenants", () =>
    HttpResponse.json({ tenants: seededOrganizations() }),
  ),
  http.post("*/api/v1/tenants", async ({ request }) => {
    const body = (await request.json()) as { slug?: string; displayName?: string };
    if (!body.slug || !body.displayName) {
      return humaError(422, "validation failed (expected required property displayName to be present)");
    }
    if (body.slug === "taken") {
      return humaError(409, `tenant slug "${body.slug}" already exists`);
    }
    return HttpResponse.json(
      {
        organization: {
          id: `t-${body.slug}`,
          slug: body.slug,
          displayName: body.displayName,
          keycloakOrgId: `kc-${body.slug}`,
          createdAt: new Date().toISOString(),
        },
        teams: [],
      },
      { status: 201 },
    );
  }),

  // ---- catalog ----
  http.get(`${BASE}/catalog`, ({ request }) => {
    const url = new URL(request.url);
    const items = listCatalogItemsFiltered({
      source: url.searchParams.get("source"),
    });
    return HttpResponse.json({ items: items.map(toServerItem) });
  }),

  http.get(`${BASE}/catalog/:item`, ({ params }) => {
    const item = findCatalogItem(params.item as string);
    if (!item) return humaError(404, "catalog item not found");
    return HttpResponse.json({ item: toServerItem(item) });
  }),

  // ---- deploys ----
  http.post(`${BASE}/deploys`, async ({ request }) => {
    const body = (await request.json()) as CreateDeployRequest;
    if (!body.itemId || !findCatalogItem(body.itemId)) {
      return humaError(400, "unknown catalog item");
    }
    if (body.name && !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    // Deterministic request-time OPA denial for exercising policy UX (§5.11).
    if (body.name === "policy-denied") {
      return HttpResponse.json(
        {
          title: "Error",
          status: 422,
          detail: "denied by policy inari.storage/max-size: storage.size 500Gi exceeds tenant quota of 100Gi",
          remediation:
            "Reduce spec.storage.size to 100Gi or less, or request a quota increase via Approvals.",
        },
        { status: 422 },
      );
    }
    const deploy = createDeployMock("acme", body);
    return HttpResponse.json({ deploy: toServerDeployResult(deploy) }, { status: 201 });
  }),

  // ---- instances (resources) ----
  http.get(`${BASE}/instances`, ({ params }) => {
    return HttpResponse.json({
      instances: listResourcesForTenant(params.org as string).map(toServerInstance),
    });
  }),

  http.get(`${BASE}/instances/:id`, ({ params }) => {
    // Deploy progression drives instance health (the wizard polls this).
    const deploy = pollDeployMock(params.id as string);
    if (deploy) {
      return HttpResponse.json({ instance: instanceViewForDeploy(deploy) });
    }
    const resource = findResource(params.id as string);
    if (!resource) return humaError(404, "instance not found");
    return HttpResponse.json({ instance: toServerInstance(resource) });
  }),

  http.get(`${BASE}/instances/:id/diff`, ({ params, request }) => {
    const url = new URL(request.url);
    const diff = upgradeDiffFor(params.id as string, url.searchParams.get("to") ?? "");
    if (!diff) return humaError(404, "instance not found");
    return HttpResponse.json({
      diff: {
        instanceId: params.id,
        itemId: "",
        currentVersion: diff.from,
        targetVersion: diff.to,
        currentManifest: diff.currentManifest,
        targetManifest: diff.upgradedManifest,
      },
    });
  }),

  http.post(`${BASE}/instances/:id/upgrade`, async ({ params, request }) => {
    const body = (await request.json()) as { toVersion?: string };
    const deploy = upgradeResourceMock(params.id as string, body.toVersion ?? "");
    if (!deploy) return humaError(404, "instance not found");
    return HttpResponse.json({ deploy: toServerDeployResult(deploy) }, { status: 201 });
  }),

  // ---- clusters ----
  http.get(`${BASE}/clusters`, ({ params }) => {
    return HttpResponse.json({
      clusters: listForTenant(params.org as string).map(toServerCluster),
    });
  }),

  http.post(`${BASE}/clusters`, async ({ params, request }) => {
    const body = (await request.json()) as CreateClusterRequest & Record<string, unknown>;
    // Mirror the cluster-registry huma schema: strict properties.
    const extra = Object.keys(body).filter((k) => k !== "name" && k !== "labels");
    if (extra.length > 0) {
      return humaError(422, `validation failed (unexpected property ${extra[0]})`);
    }
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    const created = registerCluster(params.org as string, body);
    return HttpResponse.json({ cluster: toServerCluster(created.cluster) }, { status: 201 });
  }),

  http.post(`${BASE}/clusters/:id/tokens`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    return HttpResponse.json({
      token: `inari-reg-${cluster.name}-token`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
  }),

  http.get(`${BASE}/clusters/:id`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    return HttpResponse.json({ cluster: toServerCluster(cluster) });
  }),

  // Only pending registrations can be cancelled; anything else is a conflict.
  http.delete(`${BASE}/clusters/:id`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    if (cluster.status !== "pending") {
      return humaError(409, "only pending registrations can be cancelled");
    }
    removeCluster(cluster.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/clusters/:id/capabilities`, ({ params }) => {
    const caps = capabilitiesFor(params.id as string);
    if (!caps) return humaError(404, "cluster not found");
    return HttpResponse.json({
      capabilities: caps.map((c) => ({
        id: c.id,
        kind: c.kind,
        name: c.name,
        group: c.group,
        version: c.version,
        managementMode: c.managementMode,
        lastSeenAt: c.updatedAt,
      })),
    });
  }),

  http.post(`${BASE}/clusters/:id/install-manifest`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    const token = `inari-reg-${cluster.name}-token`;
    return new HttpResponse(
      `# install manifest for ${cluster.name}\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: inari-system\n---\n# token: ${token}\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: inari-agent\n  namespace: inari-system\nspec:\n  replicas: 1\n`,
      { headers: { "content-type": "text/yaml" } },
    );
  }),

  // ---- cloud accounts (M3) ----
  http.get(`${BASE}/cloud-accounts`, ({ params }) => {
    return HttpResponse.json({
      accounts: listAccounts(params.org as string).map(toServerCloudAccount),
    });
  }),

  http.get(`${BASE}/cloud-accounts/:id`, ({ params }) => {
    const account = findAccount(params.id as string);
    if (!account) return humaError(404, "cloud account not found");
    return HttpResponse.json({ account: toServerCloudAccount(account) });
  }),

  http.post(`${BASE}/cloud-accounts`, async ({ params, request }) => {
    const body = (await request.json()) as {
      accountId?: string;
      roleArn?: string;
      externalId?: string;
      issuerUrl?: string;
      provider?: string;
      runContext?: string;
    };
    if (!body.accountId || !/^\d{12}$/.test(body.accountId)) {
      return humaError(400, "accountId must be a 12-digit AWS account ID");
    }
    if (!body.roleArn || !/^arn:aws:iam::\d{12}:role\/.+/.test(body.roleArn)) {
      return humaError(400, "roleArn must be an arn:aws:iam::<acct>:role/<name> ARN");
    }
    const account = createAccount(params.org as string, {
      accountId: body.accountId,
      roleArn: body.roleArn,
      externalId: body.externalId,
    });
    return HttpResponse.json({ account: toServerCloudAccount(account) });
  }),

  http.get(`${BASE}/cloud-accounts/:id/providerconfig`, ({ params, request }) => {
    const account = findAccount(params.id as string);
    if (!account) return humaError(404, "cloud account not found");
    const url = new URL(request.url);
    const clusterId = url.searchParams.get("clusterId");
    if (!clusterId) return humaError(400, "clusterId query parameter is required");
    // The huma endpoint renders the manifest as a plain-text body.
    return HttpResponse.json(providerConfigManifestFor(account, clusterId));
  }),

  http.post(`${BASE}/cloud-accounts/:id/validate`, ({ params }) => {
    const account = validateAccount(params.id as string);
    if (!account) return humaError(404, "cloud account not found");
    return HttpResponse.json({ account: toServerCloudAccount(account) });
  }),

  // ---- rbac (M3) ----
  http.get(`${BASE}/rbac`, ({ params }) => {
    return HttpResponse.json({ rbac: rbacMatrixFor(params.org as string) });
  }),

  http.put(`${BASE}/rbac/mappings`, async ({ params, request }) => {
    const body = (await request.json()) as {
      groupPath?: string;
      clusterRole?: string;
      mapped?: boolean;
    };
    if (!body.groupPath || !body.clusterRole) {
      return humaError(400, "groupPath and clusterRole are required");
    }
    setRbacMappingMock(params.org as string, body.groupPath, body.clusterRole, Boolean(body.mapped));
    return HttpResponse.json({ ok: true });
  }),

  // ---- approvals (M3) ----
  http.get(`${BASE}/approvals`, ({ params, request }) => {
    const url = new URL(request.url);
    // Wire contract: ?state=pending (inbox) / ?requester=me (own requests).
    const requester = url.searchParams.get("requester");
    const state = url.searchParams.get("state");
    return HttpResponse.json({
      approvals: listApprovalsFor(params.org as string, { requester, state }).map(
        toServerApproval,
      ),
    });
  }),

  http.post(`${BASE}/approvals/:id/decide`, async ({ params, request }) => {
    const body = (await request.json()) as { approve?: boolean; reason?: string };
    if (typeof body.approve !== "boolean") return humaError(400, "approve is required");
    if (!body.reason?.trim()) return humaError(400, "a decision reason is required");
    const approval = decideApprovalMock(
      params.id as string,
      body.approve ? "approve" : "reject",
      body.reason,
    );
    if (!approval) return humaError(409, "approval not found or already decided");
    return HttpResponse.json({ approval: toServerApproval(approval) });
  }),

  // ---- audit (M3) ----
  http.get(`${BASE}/audit`, ({ params, request }) => {
    const url = new URL(request.url);
    const events = listAuditFor(params.org as string, {
      actor: url.searchParams.get("actor") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      objectType: url.searchParams.get("objectType") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return HttpResponse.json({ events });
  }),

  http.get(`${BASE}/audit/export`, ({ params, request }) => {
    const url = new URL(request.url);
    const events = listAuditFor(params.org as string, {
      actor: url.searchParams.get("actor") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      objectType: url.searchParams.get("objectType") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return new HttpResponse(auditCsv(events), {
      headers: { "content-type": "text/csv" },
    });
  }),

  // ---- platform resources (M3) ----
  http.get(`${BASE}/platform-resources`, ({ params }) => {
    return HttpResponse.json({ resources: listPlatformResources(params.org as string) });
  }),

  // ---- tenant zones (M3) ----
  http.get(`${BASE}/zones`, ({ params }) => {
    return HttpResponse.json({
      zones: listZonesFor(params.org as string).map(toServerZone),
    });
  }),

  http.get(`${BASE}/zones/:id`, ({ params }) => {
    const zone = pollZoneMock(params.id as string);
    if (!zone) return humaError(404, "zone not found");
    return HttpResponse.json({ zone: toServerZone(zone), steps: toServerZoneSteps(zone) });
  }),

  http.post(`${BASE}/zones`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<CreateZoneRequestBody>;
    if (
      !body.displayName ||
      !body.slug ||
      !/^[a-z0-9][a-z0-9-]*$/.test(body.slug)
    ) {
      return humaError(400, "displayName and a lowercase dashed slug are required");
    }
    if (!body.ouId || !body.managementAccountId || !body.region) {
      return humaError(400, "ouId, managementAccountId, and region are required");
    }
    if (body.tier !== "starter") {
      return humaError(400, "only the starter tier is available at this time");
    }
    const zone = createZoneMock(params.org as string, body as CreateZoneRequestBody);
    return HttpResponse.json({ zone: toServerZone(zone) }, { status: 201 });
  }),

  http.post(`${BASE}/zones/:id/decommission`, ({ params }) => {
    // Huma contract: no request body; responds {approvalId} while the zone
    // moves to decommission_pending_approval.
    const approval = requestDecommissionMock(params.id as string);
    if (!approval) return humaError(409, "zone not found or not active");
    return HttpResponse.json({ approvalId: approval.id });
  }),

  // ---- extensions (M4) ----
  http.get(`${BASE}/extensions/ui`, () => {
    return HttpResponse.json({ extensions: listUiExtensionMocks() });
  }),

  http.post(`${BASE}/extensions/ui`, async ({ request }) => {
    const body = (await request.json()) as { name?: string; remoteEntryUrl?: string };
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    if (!body.remoteEntryUrl || !/^(https?:\/\/|\/)/.test(body.remoteEntryUrl)) {
      return humaError(400, "remoteEntryUrl must be a URL or absolute path");
    }
    if (listUiExtensionMocks().some((e) => e.name === body.name)) {
      return humaError(409, "extension already installed");
    }
    const extension = addUiExtensionMock({ name: body.name, remoteEntryUrl: body.remoteEntryUrl });
    return HttpResponse.json({ extension }, { status: 201 });
  }),

  http.delete(`${BASE}/extensions/ui/:name`, ({ params }) => {
    if (!removeUiExtensionMock(params.name as string)) {
      return humaError(404, "extension not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/extensions`, () => {
    return HttpResponse.json({ extensions: listBackendExtensionMocks() });
  }),

  http.get(`${BASE}/authz/self/extensions`, () => {
    return HttpResponse.json({ permissions: selfExtensionPermissions });
  }),

  // ---- templates / scaffolds (M4) ----
  http.get(`${BASE}/templates`, () => {
    return HttpResponse.json({ templates: listTemplateMocks() });
  }),

  http.get(`${BASE}/templates/:id`, ({ params }) => {
    const template = findTemplateMock(params.id as string);
    if (!template) return humaError(404, "template not found");
    return HttpResponse.json({ template });
  }),

  http.post(`${BASE}/scaffolds`, async ({ params, request }) => {
    const body = (await request.json()) as {
      templateId?: string;
      name?: string;
      parameters?: Record<string, unknown>;
    };
    if (!body.templateId || !findTemplateMock(body.templateId)) {
      return humaError(400, "unknown template");
    }
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    const scaffold = createScaffoldMock(params.org as string, {
      templateId: body.templateId,
      name: body.name,
      parameters: body.parameters ?? {},
    });
    return HttpResponse.json({ scaffold }, { status: 201 });
  }),

  http.get(`${BASE}/scaffolds/:id`, ({ params }) => {
    const scaffold = pollScaffoldMock(params.id as string);
    if (!scaffold) return humaError(404, "scaffold run not found");
    return HttpResponse.json({ scaffold });
  }),

  // ---- fleet (M4) ----
  http.get(`${BASE}/cluster-sets`, ({ params }) => {
    return HttpResponse.json({
      clusterSets: listClusterSetMocks(params.org as string),
    });
  }),

  http.post(`${BASE}/cluster-sets`, async ({ params, request }) => {
    const body = (await request.json()) as {
      name?: string;
      labelSelector?: Record<string, string>;
    };
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    const clusterSet = createClusterSetMock(params.org as string, {
      name: body.name,
      labelSelector: body.labelSelector ?? {},
    });
    return HttpResponse.json({ clusterSet }, { status: 201 });
  }),

  http.get(`${BASE}/cluster-sets/:id`, ({ params }) => {
    const clusterSet = getClusterSetMock(params.id as string);
    if (!clusterSet) return humaError(404, "cluster set not found");
    return HttpResponse.json({ clusterSet });
  }),

  http.delete(`${BASE}/cluster-sets/:id`, ({ params }) => {
    if (!deleteClusterSetMock(params.id as string)) {
      return humaError(404, "cluster set not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/cluster-sets/:id/members`, ({ params }) => {
    if (!getClusterSetMock(params.id as string)) {
      return humaError(404, "cluster set not found");
    }
    return HttpResponse.json({ clusters: listClusterSetMembersMock(params.id as string) });
  }),

  http.get(`${BASE}/rollouts`, ({ params }) => {
    return HttpResponse.json({
      rollouts: listRolloutMocks(params.org as string),
    });
  }),

  http.get(`${BASE}/rollouts/:id`, ({ params }) => {
    const rollout = pollRolloutMock(params.id as string);
    if (!rollout) return humaError(404, "rollout not found");
    return HttpResponse.json({ rollout });
  }),

  http.get(`${BASE}/rollouts/:id/targets`, ({ params, request }) => {
    const rollout = getRolloutMock(params.id as string);
    if (!rollout) return humaError(404, "rollout not found");
    const url = new URL(request.url);
    const stage = url.searchParams.get("stage");
    const targets = listRolloutTargetsMock(params.id as string);
    return HttpResponse.json({
      targets: stage === null ? targets : targets.filter((t) => t.stage === Number(stage)),
    });
  }),

  http.post(`${BASE}/rollouts/:id/rollback`, ({ params }) => {
    const rollout = rollbackRolloutMock(params.id as string);
    if (!rollout) return humaError(404, "rollout not found");
    return HttpResponse.json({ rollout });
  }),

  http.get(`${BASE}/drift`, ({ request }) => {
    // ListDriftOutputBody carries driftEvents, not drift.
    const status = new URL(request.url).searchParams.get("status");
    const events = listDriftMocks().filter((d) => !status || d.status === status);
    return HttpResponse.json({ driftEvents: events });
  }),

  http.get(`${BASE}/agent-channels`, () => {
    return HttpResponse.json({ channels: listAgentChannelMocks() });
  }),

  http.put(`${BASE}/cluster-sets/:id/channels/:channel`, async ({ params, request }) => {
    const channel = params.channel as string;
    if (channel !== "stable" && channel !== "canary") {
      return humaError(400, "channel must be stable or canary");
    }
    const body = (await request.json()) as { desiredAgentVersion?: string };
    if (!body.desiredAgentVersion) {
      return humaError(400, "desiredAgentVersion is required");
    }
    const updated = setAgentChannelMock(
      params.id as string,
      channel as AgentChannel,
      body.desiredAgentVersion,
    );
    if (!updated) return humaError(404, "cluster set not found");
    return HttpResponse.json({ channel: updated });
  }),
];

interface CreateZoneRequestBody {
  slug: string;
  displayName: string;
  ouId: string;
  managementAccountId: string;
  region: string;
  tier: string;
  tags?: Record<string, string>;
}
