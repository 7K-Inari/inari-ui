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
  listCatalogItemsFiltered,
  listResourcesForTenant,
  pollDeployMock,
  upgradeDiffFor,
  upgradeResourceMock,
} from "@/mocks/fixtures/catalog";
import type {
  ClusterSummary,
  ClusterDetail,
  CreateClusterRequest,
  CreateDeployRequest,
  Deploy,
  ResourceInstanceDetail,
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
  listProviderConfigs,
  listZonesFor,
  pollZoneMock,
  rbacMatrixFor,
  requestDecommissionMock,
  setRbacMappingMock,
  trustSnippetFor,
  validateAccount,
} from "@/mocks/fixtures/m3";

import {
  addUiExtensionMock,
  createClusterSetMock,
  createScaffoldMock,
  decideGateMock,
  deleteClusterSetMock,
  findTemplateMock,
  getClusterSetMock,
  listAgentChannelMocks,
  listBackendExtensionMocks,
  listClusterSetMocks,
  listDriftMocks,
  listRolloutMocks,
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
    agentVersion: "agentVersion" in c ? c.agentVersion : null,
    lastSeenAt: c.lastSeenAt,
    createdAt: c.createdAt,
  };
}

function toServerItem(i: any) {
  return {
    id: i.id,
    source: i.source,
    name: i.name,
    displayName: i.displayName,
    description: i.description,
    category: i.category,
    docs: i.docs,
    gitopsPolicy: i.policy?.gitopsMode,
    lockedFields: i.policy?.lockedFields ?? [],
    policyNotes: i.policy?.notes ?? [],
    approvalPolicy: i.policy?.approvalRequired ? "platform-admin" : "auto",
    versions: (i.versions ?? []).map((v: any, idx: number) => ({
      id: `${i.id}-${v.version}`,
      itemId: i.id,
      version: v.version,
      channel: v.channel,
      deprecated: v.deprecated,
      releasedAt: v.releasedAt,
      schema: idx === 0 ? (i.schema ?? {}) : undefined,
      uiHints: idx === 0 ? (i.uiHints ?? {}) : undefined,
    })),
    pinnedVersion: i.latestVersion ?? "",
    compatibleClusterIds: i.compatibleClusterIds ?? null,
  };
}

function toServerInstance(r: ResourceInstanceDetail | any) {
  return {
    id: r.id,
    orgId: r.tenant,
    clusterId: r.clusterId,
    clusterName: r.clusterName,
    catalogItemId: r.catalogItemId,
    version: r.version,
    ownerTeam: r.ownerTeam,
    spec: r.spec ?? {},
    resourceRef: { name: r.name },
    health: r.health,
    state: r.status,
    statusMessage: "",
    prUrl: r.prUrl ?? "",
    argocdUrl: r.argocdUrl ?? null,
    newVersionAvailable: Boolean(r.updateAvailable),
    latestVersion: r.updateAvailable?.to ?? "",
    composedResources: r.composedResources ?? [],
    createdAt: r.createdAt,
  };
}

function toServerDeployResult(d: Deploy) {
  return {
    instanceId: d.instanceId ?? d.id,
    version: d.version,
    status: d.phase === "pending" ? "pending_approval" : "deploying",
    commitSha: "",
    prUrl: d.prUrl ?? "",
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
  http.post("*/api/v1/tenants", async ({ request }) => {
    const body = (await request.json()) as { slug?: string; name?: string };
    if (!body.slug || !body.name) {
      return humaError(400, "slug and name are required");
    }
    if (body.slug === "taken") {
      return humaError(409, `tenant slug "${body.slug}" already exists`);
    }
    return HttpResponse.json(
      {
        tenant: {
          id: `t-${body.slug}`,
          slug: body.slug,
          name: body.name,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  }),

  // ---- catalog ----
  http.get(`${BASE}/catalog`, ({ request }) => {
    const url = new URL(request.url);
    const items = listCatalogItemsFiltered({
      source: url.searchParams.get("source"),
      category: url.searchParams.get("category"),
      clusterId: url.searchParams.get("clusterId"),
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
      return HttpResponse.json({
        instance: {
          id: deploy.id,
          orgId: deploy.tenant,
          clusterId: deploy.clusterId,
          catalogItemId: deploy.itemId,
          version: deploy.version,
          resourceRef: { name: deploy.name },
          health:
            deploy.phase === "healthy"
              ? "healthy"
              : deploy.phase === "failed"
                ? "degraded"
                : "progressing",
          state: deploy.phase,
          statusMessage: deploy.message ?? "",
          prUrl: deploy.prUrl ?? "",
          createdAt: deploy.createdAt,
        },
      });
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
    const body = (await request.json()) as CreateClusterRequest;
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
    return HttpResponse.json({ accounts: listAccounts(params.org as string) });
  }),

  http.get(`${BASE}/cloud-accounts/:id`, ({ params }) => {
    const account = findAccount(params.id as string);
    if (!account) return humaError(404, "cloud account not found");
    return HttpResponse.json({ account });
  }),

  http.post(`${BASE}/cloud-accounts`, async ({ params, request }) => {
    const body = (await request.json()) as {
      name?: string;
      accountId?: string;
      regions?: string[];
    };
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    if (!body.accountId || !/^\d{12}$/.test(body.accountId)) {
      return humaError(400, "accountId must be a 12-digit AWS account ID");
    }
    const account = createAccount(params.org as string, {
      name: body.name,
      accountId: body.accountId,
      regions: body.regions ?? [],
    });
    return HttpResponse.json(
      { account, trust: trustSnippetFor(account) },
      { status: 201 },
    );
  }),

  http.get(`${BASE}/cloud-accounts/:id/trust-snippet`, ({ params }) => {
    const account = findAccount(params.id as string);
    if (!account) return humaError(404, "cloud account not found");
    return HttpResponse.json({ trust: trustSnippetFor(account) });
  }),

  http.post(`${BASE}/cloud-accounts/:id/validate`, ({ params }) => {
    const result = validateAccount(params.id as string);
    if (!result) return humaError(404, "cloud account not found");
    return HttpResponse.json({ validation: result });
  }),

  http.get(`${BASE}/provider-configs`, ({ params }) => {
    return HttpResponse.json({ providerConfigs: listProviderConfigs(params.org as string) });
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
    const view = url.searchParams.get("view") === "requested" ? "requested" : "inbox";
    return HttpResponse.json({ approvals: listApprovalsFor(params.org as string, view) });
  }),

  http.post(`${BASE}/approvals/:id/:decision`, async ({ params, request }) => {
    const decision = params.decision as string;
    if (decision !== "approve" && decision !== "reject") {
      return humaError(404, "unknown decision");
    }
    const body = (await request.json()) as { reason?: string };
    if (!body.reason?.trim()) return humaError(400, "a decision reason is required");
    const approval = decideApprovalMock(params.id as string, decision, body.reason);
    if (!approval) return humaError(409, "approval not found or already decided");
    return HttpResponse.json({ approval });
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
    return HttpResponse.json({ zones: listZonesFor(params.org as string) });
  }),

  http.get(`${BASE}/zones/:id`, ({ params }) => {
    const zone = pollZoneMock(params.id as string);
    if (!zone) return humaError(404, "zone not found");
    return HttpResponse.json({ zone });
  }),

  http.post(`${BASE}/zones`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<CreateZoneRequestBody>;
    if (!body.name || !body.slug || !/^[a-z0-9][a-z0-9-]*$/.test(body.slug)) {
      return humaError(400, "name and a lowercase dashed slug are required");
    }
    if (body.tier !== "starter") {
      return humaError(400, "only the starter tier is available at this time");
    }
    const zone = createZoneMock(params.org as string, body as CreateZoneRequestBody);
    return HttpResponse.json({ zone }, { status: 201 });
  }),

  http.post(`${BASE}/zones/:id/decommission`, async ({ params, request }) => {
    const body = (await request.json()) as { reason?: string };
    if (!body.reason?.trim()) return humaError(400, "a decommission reason is required");
    const zone = requestDecommissionMock(params.id as string, body.reason);
    if (!zone) return humaError(409, "zone not found or not active");
    return HttpResponse.json({ zone });
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
  http.get(`${BASE}/clustersets`, ({ params }) => {
    return HttpResponse.json({ clusterSets: listClusterSetMocks(params.org as string) });
  }),

  http.post(`${BASE}/clustersets`, async ({ params, request }) => {
    const body = (await request.json()) as {
      name?: string;
      labels?: Record<string, string>;
    };
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    const clusterSet = createClusterSetMock(params.org as string, {
      name: body.name,
      labels: body.labels ?? {},
    });
    return HttpResponse.json({ clusterSet }, { status: 201 });
  }),

  http.get(`${BASE}/clustersets/:id`, ({ params }) => {
    const clusterSet = getClusterSetMock(params.id as string);
    if (!clusterSet) return humaError(404, "cluster set not found");
    return HttpResponse.json({ clusterSet });
  }),

  http.delete(`${BASE}/clustersets/:id`, ({ params }) => {
    if (!deleteClusterSetMock(params.id as string)) {
      return humaError(404, "cluster set not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/fleet/rollouts`, ({ params }) => {
    return HttpResponse.json({ rollouts: listRolloutMocks(params.org as string) });
  }),

  http.get(`${BASE}/fleet/rollouts/:id`, ({ params }) => {
    const rollout = pollRolloutMock(params.id as string);
    if (!rollout) return humaError(404, "rollout not found");
    return HttpResponse.json({ rollout });
  }),

  http.post(`${BASE}/fleet/rollouts/:id/gates/:stage/:decision`, ({ params }) => {
    const decision = params.decision as string;
    if (decision !== "approve" && decision !== "reject") {
      return humaError(404, "unknown decision");
    }
    const rollout = decideGateMock(
      params.id as string,
      params.stage as string,
      decision,
    );
    if (!rollout) return humaError(409, "rollout or gate not found, or gate not open");
    return HttpResponse.json({ rollout });
  }),

  http.post(`${BASE}/fleet/rollouts/:id/rollback`, ({ params }) => {
    const rollout = rollbackRolloutMock(params.id as string);
    if (!rollout) return humaError(404, "rollout not found");
    return HttpResponse.json({ rollout });
  }),

  http.get(`${BASE}/fleet/drift`, () => {
    return HttpResponse.json({ drift: listDriftMocks() });
  }),

  http.get(`${BASE}/fleet/agent-channels`, () => {
    return HttpResponse.json({ channels: listAgentChannelMocks() });
  }),

  http.put(`${BASE}/fleet/agent-channels/:clusterSetId`, async ({ params, request }) => {
    const body = (await request.json()) as { channel?: string };
    if (body.channel !== "stable" && body.channel !== "canary") {
      return humaError(400, "channel must be stable or canary");
    }
    const channel = setAgentChannelMock(params.clusterSetId as string, body.channel);
    if (!channel) return humaError(404, "cluster set not found");
    return HttpResponse.json({ channel });
  }),
];

interface CreateZoneRequestBody {
  name: string;
  slug: string;
  orgUnit: string;
  region: string;
  tier: "starter";
}
