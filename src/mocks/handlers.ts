import { http, HttpResponse } from "msw";

import {
  capabilitiesFor,
  findCluster,
  kubectlProxyEnabledFor,
  listForTenant,
  mockControl,
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
  setRbacMappingsMock,
  validateAccount,
} from "@/mocks/fixtures/m3";

import {
  addUiExtensionMock,
  cancelScaffoldRunMock,
  createClusterSetMock,
  createScaffoldRunMock,
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
  pollScaffoldRunMock,
  retryScaffoldRunMock,
  removeUiExtensionMock,
  rollbackRolloutMock,
  selfExtensionPermissions,
  setAgentChannelMock,
} from "@/mocks/fixtures/m4";

import type { components } from "@/api/__generated__/schema";
import {
  addTeamMemberMock,
  assignPackMock,
  createPackMock,
  createTeamMock,
  decideExemptionMock,
  deleteOrgMemberMock,
  deleteTeamMock,
  evaluateMock,
  exemptionsFor,
  getOrgMock,
  gitConfigFor,
  listOrgsMock,
  orgMembersFor,
  packsFor,
  patchOrgMock,
  policiesFor,
  putOrgMemberMock,
  putVisibilityMock,
  recordRegistrationTokenMock,
  registrationTokensFor,
  removeTeamMemberMock,
  requestExemptionMock,
  revokeRegistrationTokenMock,
  setGitConfigMock,
  teamMembersFor,
  teamsFor,
  unassignPackMock,
  visibilityFor,
  approvalConfigFor,
  createOidcClientMock,
  createSecretStoreMock,
  deleteOidcClientMock,
  deleteSecretStoreMock,
  findOidcClient,
  findSecretStore,
  oidcClientsFor,
  oidcScopesCatalog,
  putApprovalConfigMock,
  putClientScopesMock,
  secretStoreStatusFor,
  secretStoresFor,
  updateOidcClientMock,
  updateSecretStoreMock,
  deleteIdpProviderMock,
  domainClaimConflict,
  idpProviderFor,
  putDomainHintsMock,
  putIdpProviderMock,
  rotateIdpSecretMock,
  createNotificationEndpointMock,
  deleteNotificationEndpointMock,
  findNotificationEndpoint,
  notificationEndpointsFor,
  updateNotificationEndpointMock,
} from "@/mocks/fixtures/m6";
import type { NotificationEndpointInput } from "@/mocks/fixtures/m6";
import type { OidcClientInput } from "@/api/identity";
import type { OidcProviderInput } from "@/api/idp";
import type {
  CreateSecretStoreInput,
  UpdateSecretStoreInput,
} from "@/api/secret-stores";

type CreatePackInputBody = components["schemas"]["CreatePackInputBody"];
type AssignPackInputBody = components["schemas"]["AssignPackInputBody"];
type RequestExemptionInputBody =
  components["schemas"]["RequestExemptionInputBody"];
type DecideExemptionInputBody =
  components["schemas"]["DecideExemptionInputBody"];
type EvaluateInputBody = components["schemas"]["EvaluateInputBody"];
type GitConfigInputBody = components["schemas"]["GitConfigInputBody"];

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
    kubectlProxyDisabled: c.kubectlProxyDisabled,
    lastSeenAt: c.lastSeenAt,
    createdAt: c.createdAt,
  };
}

// ---- M3: cloud accounts (huma CloudAccount wire shape) ----

// Orgs the mock caller belongs to; PATCH /tenants/:org (M6.W2) mutates these
// via the m6 mock state so the profile page round-trips.
function seededOrganizations() {
  return listOrgsMock();
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

  // ---- server-driven feature flags (kubectl-proxy e2e access) ----
  http.get("*/api/v1/features", () =>
    HttpResponse.json({
      kubectlProxy: { enabled: mockControl.getState().kubectlProxyEnabled },
    }),
  ),

  // ---- tenants (platform-scoped, not under /tenants/:org) ----
  http.get("*/api/v1/tenants", () =>
    HttpResponse.json({ tenants: seededOrganizations() }),
  ),
  http.post("*/api/v1/tenants", async ({ request }) => {
    const body = (await request.json()) as {
      slug?: string;
      displayName?: string;
    };
    if (!body.slug || !body.displayName) {
      return humaError(
        422,
        "validation failed (expected required property displayName to be present)",
      );
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
    const { items, total } = listCatalogItemsFiltered({
      q: url.searchParams.get("q"),
      source: url.searchParams.get("source"),
      category: url.searchParams.get("category"),
      sort: url.searchParams.get("sort"),
      limit: Number(url.searchParams.get("limit") ?? "0"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    });
    return HttpResponse.json({ items: items.map(toServerItem), total });
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
          detail:
            "denied by policy inari.storage/max-size: storage.size 500Gi exceeds tenant quota of 100Gi",
          remediation:
            "Reduce spec.storage.size to 100Gi or less, or request a quota increase via Approvals.",
        },
        { status: 422 },
      );
    }
    const deploy = createDeployMock("acme", body);
    return HttpResponse.json(
      { deploy: toServerDeployResult(deploy) },
      { status: 201 },
    );
  }),

  // ---- instances (resources) ----
  http.get(`${BASE}/instances`, ({ params }) => {
    return HttpResponse.json({
      instances: listResourcesForTenant(params.org as string).map(
        toServerInstance,
      ),
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
    const diff = upgradeDiffFor(
      params.id as string,
      url.searchParams.get("to") ?? "",
    );
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
    const deploy = upgradeResourceMock(
      params.id as string,
      body.toVersion ?? "",
    );
    if (!deploy) return humaError(404, "instance not found");
    return HttpResponse.json(
      { deploy: toServerDeployResult(deploy) },
      { status: 201 },
    );
  }),

  // ---- clusters ----
  http.get(`${BASE}/clusters`, ({ params }) => {
    return HttpResponse.json({
      clusters: listForTenant(params.org as string).map(toServerCluster),
    });
  }),

  http.post(`${BASE}/clusters`, async ({ params, request }) => {
    const body = (await request.json()) as CreateClusterRequest &
      Record<string, unknown>;
    // Mirror the cluster-registry huma schema: strict properties.
    const extra = Object.keys(body).filter(
      (k) => k !== "name" && k !== "labels",
    );
    if (extra.length > 0) {
      return humaError(
        422,
        `validation failed (unexpected property ${extra[0]})`,
      );
    }
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    const created = registerCluster(params.org as string, body);
    return HttpResponse.json(
      { cluster: toServerCluster(created.cluster) },
      { status: 201 },
    );
  }),

  http.post(`${BASE}/clusters/:id/tokens`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    const record = recordRegistrationTokenMock(cluster.id);
    return HttpResponse.json({
      token: `inari-reg-${cluster.name}-token`,
      expiresAt: record.expiresAt,
      record,
    });
  }),

  http.get(`${BASE}/clusters/:id/tokens`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    return HttpResponse.json({ tokens: registrationTokensFor(cluster.id) });
  }),

  http.delete(`${BASE}/clusters/:id/tokens/:tokenId`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    if (!revokeRegistrationTokenMock(cluster.id, params.tokenId as string)) {
      return humaError(404, "token not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/clusters/:id`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    return HttpResponse.json({
      cluster: toServerCluster(cluster),
      kubectlProxyEnabled: kubectlProxyEnabledFor(cluster),
    });
  }),

  // Mirror the cluster-registry huma schema: strict properties.
  http.patch(`${BASE}/clusters/:id`, async ({ params, request }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    const body = (await request.json()) as { kubectlProxyDisabled?: boolean } &
      Record<string, unknown>;
    const extra = Object.keys(body).filter((k) => k !== "kubectlProxyDisabled");
    if (extra.length > 0) {
      return humaError(422, `validation failed (unexpected property ${extra[0]})`);
    }
    if (typeof body.kubectlProxyDisabled !== "boolean") {
      return humaError(422, "validation failed (kubectlProxyDisabled must be a boolean)");
    }
    cluster.kubectlProxyDisabled = body.kubectlProxyDisabled;
    return HttpResponse.json({
      cluster: toServerCluster(cluster),
      kubectlProxyEnabled: kubectlProxyEnabledFor(cluster),
    });
  }),

  http.get(`${BASE}/clusters/:id/access-info`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) return humaError(404, "cluster not found");
    return HttpResponse.json({
      accessInfo: {
        issuerUrl: "http://keycloak.local/realms/inari",
        kubectlClientId: `${cluster.tenant}-kubectl`,
        audience: "kubernetes",
        organization: cluster.tenant,
      },
    });
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
      return humaError(
        400,
        "roleArn must be an arn:aws:iam::<acct>:role/<name> ARN",
      );
    }
    const account = createAccount(params.org as string, {
      accountId: body.accountId,
      roleArn: body.roleArn,
      externalId: body.externalId,
    });
    return HttpResponse.json({ account: toServerCloudAccount(account) });
  }),

  http.get(
    `${BASE}/cloud-accounts/:id/providerconfig`,
    ({ params, request }) => {
      const account = findAccount(params.id as string);
      if (!account) return humaError(404, "cloud account not found");
      const url = new URL(request.url);
      const clusterId = url.searchParams.get("clusterId");
      if (!clusterId)
        return humaError(400, "clusterId query parameter is required");
      // The huma endpoint renders the manifest as a plain-text body.
      return HttpResponse.json(providerConfigManifestFor(account, clusterId));
    },
  ),

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
      mappings?: { team: string; role: string }[];
    };
    // Contract: declarative whole-set replace of team→role mappings, applied
    // atomically. Translate team slugs back to group paths for mock state.
    if (!Array.isArray(body.mappings)) {
      return humaError(422, "validation failed (mappings is required)");
    }
    const org = params.org as string;
    const groups = rbacMatrixFor(org).groups;
    const mappings = body.mappings.map((m) => ({
      groupPath:
        groups.find((g) => g.team === m.team)?.path ?? `tenant-${org}/${m.team}`,
      clusterRole: m.role,
    }));
    const before = rbacMatrixFor(org).mappings;
    setRbacMappingsMock(org, mappings);
    const roleByPath = new Map(mappings.map((m) => [m.groupPath, m.clusterRole]));
    const changes = groups
      .filter(
        (g) =>
          roleByPath.get(g.path) !==
          before.find((b) => b.groupPath === g.path)?.clusterRole,
      )
      .map((g) => ({
        teamId: g.team,
        name: g.team,
        oldRole: before.find((b) => b.groupPath === g.path)?.clusterRole ?? "",
        newRole: roleByPath.get(g.path) ?? "",
      }));
    return HttpResponse.json({ changes });
  }),

  // ---- approvals inbox aggregate (server v1.6.0, caller-scoped) ----
  http.get("*/api/v1/approvals/inbox", () => {
    // "all" lists pending inbox items across every org fixture.
    const items = listApprovalsFor("all", { state: "pending" }).map(
      toServerApproval,
    );
    return HttpResponse.json({ items });
  }),

  // ---- approvals (M3) ----
  http.get(`${BASE}/approvals`, ({ params, request }) => {
    const url = new URL(request.url);
    // Wire contract: ?state=pending (inbox) / ?requester=me (own requests).
    const requester = url.searchParams.get("requester");
    const state = url.searchParams.get("state");
    return HttpResponse.json({
      approvals: listApprovalsFor(params.org as string, {
        requester,
        state,
      }).map(toServerApproval),
    });
  }),

  http.post(`${BASE}/approvals/:id/decide`, async ({ params, request }) => {
    const body = (await request.json()) as {
      approve?: boolean;
      reason?: string;
    };
    if (typeof body.approve !== "boolean")
      return humaError(400, "approve is required");
    if (!body.reason?.trim())
      return humaError(400, "a decision reason is required");
    const approval = decideApprovalMock(
      params.id as string,
      body.approve ? "approve" : "reject",
      body.reason,
    );
    if (!approval)
      return humaError(409, "approval not found or already decided");
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
    return HttpResponse.json({
      resources: listPlatformResources(params.org as string),
    });
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
    return HttpResponse.json({
      zone: toServerZone(zone),
      steps: toServerZoneSteps(zone),
    });
  }),

  http.post(`${BASE}/zones`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<CreateZoneRequestBody>;
    if (
      !body.displayName ||
      !body.slug ||
      !/^[a-z0-9][a-z0-9-]*$/.test(body.slug)
    ) {
      return humaError(
        400,
        "displayName and a lowercase dashed slug are required",
      );
    }
    if (!body.ouId || !body.managementAccountId || !body.region) {
      return humaError(
        400,
        "ouId, managementAccountId, and region are required",
      );
    }
    if (body.tier !== "starter") {
      return humaError(400, "only the starter tier is available at this time");
    }
    const zone = createZoneMock(
      params.org as string,
      body as CreateZoneRequestBody,
    );
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
    const body = (await request.json()) as {
      name?: string;
      remoteEntryUrl?: string;
    };
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(400, "name must be lowercase alphanumeric with dashes");
    }
    if (
      !body.remoteEntryUrl ||
      !/^(https?:\/\/|\/)/.test(body.remoteEntryUrl)
    ) {
      return humaError(400, "remoteEntryUrl must be a URL or absolute path");
    }
    if (listUiExtensionMocks().some((e) => e.name === body.name)) {
      return humaError(409, "extension already installed");
    }
    const extension = addUiExtensionMock({
      name: body.name,
      remoteEntryUrl: body.remoteEntryUrl,
    });
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

  http.post(`${BASE}/extensions/:id/identity/rotate`, ({ params }) => {
    if (!listBackendExtensionMocks().some((e) => e.id === params.id)) {
      return humaError(404, "extension not found");
    }
    return HttpResponse.json({
      credentials: {
        clientId: `ext-${params.id}`,
        secret: "mock-one-time-secret",
      },
    });
  }),

  http.get(`${BASE}/authz/self/extensions`, () => {
    return HttpResponse.json({ permissions: selfExtensionPermissions });
  }),

  // ---- templates / scaffolds (M4) ----
  http.get(`${BASE}/templates`, () => {
    return HttpResponse.json({ templates: listTemplateMocks() });
  }),

  http.get(`${BASE}/templates/:name`, ({ params }) => {
    const template = findTemplateMock(params.name as string);
    if (!template) return humaError(404, "template not found");
    return HttpResponse.json({ template });
  }),

  http.post(`${BASE}/templates/:name/runs`, async ({ params, request }) => {
    const body = (await request.json()) as {
      displayName?: string;
      values?: Record<string, unknown>;
      version?: string;
    };
    if (!findTemplateMock(params.name as string)) {
      return humaError(404, "unknown template");
    }
    if (body.values === undefined || typeof body.values !== "object") {
      return humaError(422, "values are required");
    }
    if (body.displayName && !/^[a-z0-9][a-z0-9-]*$/.test(body.displayName)) {
      return humaError(422, "displayName must be lowercase alphanumeric with dashes");
    }
    const run = createScaffoldRunMock(params.name as string, {
      values: body.values,
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.version !== undefined ? { version: body.version } : {}),
    });
    return HttpResponse.json({ run }, { status: 200 });
  }),

  http.get(`${BASE}/scaffold-runs/:runId`, ({ params }) => {
    const run = pollScaffoldRunMock(params.runId as string);
    if (!run) return humaError(404, "scaffold run not found");
    return HttpResponse.json({ run });
  }),

  http.post(`${BASE}/scaffold-runs/:runId/cancel`, ({ params }) => {
    const run = cancelScaffoldRunMock(params.runId as string);
    if (!run) return humaError(404, "scaffold run not found");
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/scaffold-runs/:runId/retry`, ({ params }) => {
    const run = retryScaffoldRunMock(params.runId as string);
    if (!run) return humaError(409, "scaffold run is not failed");
    return HttpResponse.json({ run });
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
    return HttpResponse.json({
      clusters: listClusterSetMembersMock(params.id as string),
    });
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
      targets:
        stage === null
          ? targets
          : targets.filter((t) => t.stage === Number(stage)),
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
    const events = listDriftMocks().filter(
      (d) => !status || d.status === status,
    );
    return HttpResponse.json({ driftEvents: events });
  }),

  http.get(`${BASE}/agent-channels`, () => {
    return HttpResponse.json({ channels: listAgentChannelMocks() });
  }),

  http.put(
    `${BASE}/cluster-sets/:id/channels/:channel`,
    async ({ params, request }) => {
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
    },
  ),

  // ---- M6.W1: settings — policy packs ----
  http.get(`${BASE}/policy-packs`, ({ params }) =>
    HttpResponse.json({ packs: packsFor(params.org as string) }),
  ),

  http.post(`${BASE}/policy-packs`, async ({ params, request }) => {
    const body = (await request.json()) as CreatePackInputBody;
    if (
      !body.name ||
      !body.engine ||
      !body.version ||
      body.manifests === undefined
    ) {
      return humaError(
        422,
        "validation failed (name, engine, version, manifests are required)",
      );
    }
    return HttpResponse.json({
      pack: createPackMock(params.org as string, body),
    });
  }),

  http.post(`${BASE}/policy-packs/:id/assign`, async ({ params, request }) => {
    const body = (await request.json()) as AssignPackInputBody;
    if (!body.targetType || !body.targetId) {
      return humaError(
        422,
        "validation failed (targetType, targetId are required)",
      );
    }
    const assignment = assignPackMock(params.id as string, body);
    if (!assignment) return humaError(404, "policy pack not found");
    return HttpResponse.json({ assignment });
  }),

  http.delete(
    `${BASE}/policy-packs/:id/assignments/:assignmentId`,
    ({ params }) => {
      if (
        !unassignPackMock(params.id as string, params.assignmentId as string)
      ) {
        return humaError(404, "assignment not found");
      }
      return new HttpResponse(null, { status: 204 });
    },
  ),

  // ---- M6.W1: settings — exemptions ----
  http.get(`${BASE}/exemptions`, ({ params }) =>
    HttpResponse.json({ exemptions: exemptionsFor(params.org as string) }),
  ),

  http.post(`${BASE}/exemptions`, async ({ params, request }) => {
    const body = (await request.json()) as RequestExemptionInputBody;
    if (!body.policyId || !body.reason || !body.expiresAt) {
      return humaError(
        422,
        "validation failed (policyId, reason, expiresAt are required)",
      );
    }
    return HttpResponse.json({
      exemption: requestExemptionMock(params.org as string, body),
    });
  }),

  http.post(`${BASE}/exemptions/:id/decide`, async ({ params, request }) => {
    const body = (await request.json()) as DecideExemptionInputBody;
    const exemption = decideExemptionMock(params.id as string, body.approve);
    if (!exemption) return humaError(404, "exemption not found");
    return HttpResponse.json({ exemption });
  }),

  // ---- M6.W1: settings — compliance ----
  http.get(`${BASE}/policies`, ({ params }) =>
    HttpResponse.json({ policies: policiesFor(params.org as string) }),
  ),

  http.post(`${BASE}/policies/evaluate`, async ({ request }) => {
    const body = (await request.json()) as EvaluateInputBody;
    if (!body.itemId || !body.version || !body.clusterId) {
      return humaError(
        422,
        "validation failed (itemId, version, clusterId are required)",
      );
    }
    return HttpResponse.json({ decision: evaluateMock() });
  }),

  // ---- M6.W1: settings — tenant git config ----
  http.get(`${BASE}/git-config`, ({ params }) => {
    const config = gitConfigFor(params.org as string);
    if (!config) return humaError(404, "git config not found");
    return HttpResponse.json({ config });
  }),

  http.put(`${BASE}/git-config`, async ({ params, request }) => {
    const body = (await request.json()) as GitConfigInputBody;
    if (!body.repo || !body.commitPolicy) {
      return humaError(
        422,
        "validation failed (repo, commitPolicy are required)",
      );
    }
    if (
      body.commitPolicy !== "direct" &&
      body.commitPolicy !== "pull_request"
    ) {
      return humaError(422, "commitPolicy must be direct or pull_request");
    }
    const config = setGitConfigMock(params.org as string, body);
    void config;
    return new HttpResponse(null, { status: 204 });
  }),

  // ---- M6.W2: org profile (proposed PATCH route) ----
  http.patch(BASE, async ({ params, request }) => {
    const body = (await request.json()) as { displayName?: string };
    if (!body.displayName) {
      return humaError(422, "validation failed (displayName is required)");
    }
    const org = patchOrgMock(params.org as string, body.displayName);
    if (!org) return humaError(404, "organization not found");
    return HttpResponse.json({
      organization: org,
      teams: teamsFor(params.org as string),
    });
  }),

  // ---- M6.W2: org-wide members (proposed routes) ----
  http.get(`${BASE}/members`, ({ params }) =>
    HttpResponse.json({ members: orgMembersFor(params.org as string) }),
  ),

  http.put(`${BASE}/members/:subject`, async ({ params, request }) => {
    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
      role?: string;
    };
    if (!body.email || !body.role) {
      return humaError(422, "validation failed (email, role are required)");
    }
    if (!getOrgMock(params.org as string))
      return humaError(404, "organization not found");
    putOrgMemberMock(params.org as string, params.subject as string, {
      email: body.email,
      displayName: body.displayName,
      role: body.role,
    });
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${BASE}/members/:subject`, ({ params }) => {
    if (!deleteOrgMemberMock(params.org as string, params.subject as string)) {
      return humaError(404, "member not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // ---- M6.W2: teams (list is contract-covered; create/delete proposed) ----
  http.get(`${BASE}/teams`, ({ params }) =>
    HttpResponse.json({ teams: teamsFor(params.org as string) }),
  ),

  http.post(`${BASE}/teams`, async ({ params, request }) => {
    const body = (await request.json()) as { name?: string };
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return humaError(
        422,
        "validation failed (name must be lowercase alphanumeric with dashes)",
      );
    }
    if (!getOrgMock(params.org as string))
      return humaError(404, "organization not found");
    const team = createTeamMock(params.org as string, body.name);
    return HttpResponse.json({ team }, { status: 201 });
  }),

  http.delete(`${BASE}/teams/:team`, ({ params }) => {
    if (!deleteTeamMock(params.org as string, params.team as string)) {
      return humaError(404, "team not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/teams/:team/members`, ({ params }) => {
    if (!teamsFor(params.org as string).some((t) => t.name === params.team)) {
      return humaError(404, "team not found");
    }
    return HttpResponse.json({
      members: teamMembersFor(params.org as string, params.team as string),
    });
  }),

  http.post(`${BASE}/teams/:team/members`, async ({ params, request }) => {
    const body = (await request.json()) as { subject?: string };
    if (!body.subject) {
      return humaError(422, "validation failed (subject is required)");
    }
    if (
      !addTeamMemberMock(
        params.org as string,
        params.team as string,
        body.subject,
      )
    ) {
      return humaError(404, "team not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${BASE}/teams/:team/members/:subject`, ({ params }) => {
    if (
      !removeTeamMemberMock(
        params.org as string,
        params.team as string,
        params.subject as string,
      )
    ) {
      return humaError(404, "member not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // ---- M6.W2: catalog visibility overlay (proposed routes) ----
  http.get(`${BASE}/catalog-visibility`, ({ params }) =>
    HttpResponse.json({ rules: visibilityFor(params.org as string) }),
  ),

  http.put(`${BASE}/catalog-visibility/:item`, async ({ params, request }) => {
    const body = (await request.json()) as { visible?: boolean };
    if (typeof body.visible !== "boolean") {
      return humaError(422, "validation failed (visible must be a boolean)");
    }
    if (!getOrgMock(params.org as string))
      return humaError(404, "organization not found");
    putVisibilityMock(
      params.org as string,
      params.item as string,
      body.visible,
    );
    return new HttpResponse(null, { status: 204 });
  }),

  // ---- M6.W3: identity — OIDC clients (proposed routes) ----
  http.get(`${BASE}/identity/clients`, ({ params }) =>
    HttpResponse.json({ clients: oidcClientsFor(params.org as string) }),
  ),

  http.post(`${BASE}/identity/clients`, async ({ params, request }) => {
    const body = (await request.json()) as OidcClientInput;
    if (!body.name) {
      return humaError(422, "validation failed (name is required)");
    }
    const client = createOidcClientMock(params.org as string, body);
    return HttpResponse.json(
      {
        client,
        secret: client.isPublic
          ? undefined
          : { clientId: client.id, secret: `sec-${client.id}-onetime` },
      },
      { status: 201 },
    );
  }),

  http.put(`${BASE}/identity/clients/:id`, async ({ params, request }) => {
    const body = (await request.json()) as OidcClientInput;
    if (!body.name) {
      return humaError(422, "validation failed (name is required)");
    }
    const client = updateOidcClientMock(
      params.org as string,
      params.id as string,
      body,
    );
    if (!client) return humaError(404, "client not found");
    return HttpResponse.json({ client });
  }),

  http.delete(`${BASE}/identity/clients/:id`, ({ params }) => {
    if (!deleteOidcClientMock(params.org as string, params.id as string)) {
      return humaError(404, "client not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/identity/clients/:id/secret:rotate`, ({ params }) => {
    const client = findOidcClient(params.org as string, params.id as string);
    if (!client) return humaError(404, "client not found");
    if (client.isPublic) return humaError(422, "public clients have no secret");
    return HttpResponse.json({
      secret: { clientId: client.id, secret: `sec-${client.id}-rotated` },
    });
  }),

  http.get(`${BASE}/identity/scopes`, () =>
    HttpResponse.json({ scopes: oidcScopesCatalog }),
  ),

  // ---- M6.W6: IdP brokering + domains ----
  http.get(`${BASE}/identity/provider`, ({ params }) =>
    HttpResponse.json({ provider: idpProviderFor(params.org as string) }),
  ),

  http.put(`${BASE}/identity/provider`, async ({ params, request }) => {
    const body = (await request.json()) as OidcProviderInput;
    if (
      !body.alias ||
      !body.issuerUrl ||
      !body.clientId ||
      !body.claimMapping ||
      !Array.isArray(body.domainHints)
    ) {
      return humaError(
        422,
        "validation failed (alias, issuerUrl, clientId, claimMapping, domainHints are required)",
      );
    }
    if (!idpProviderFor(params.org as string) && !body.clientSecret) {
      return humaError(
        422,
        "validation failed (clientSecret is required on create)",
      );
    }
    const conflict = domainClaimConflict(
      params.org as string,
      body.domainHints,
    );
    if (conflict) {
      return humaError(
        409,
        `domain "${conflict}" is already claimed by another organization`,
      );
    }
    const provider = putIdpProviderMock(params.org as string, body);
    return HttpResponse.json({ provider });
  }),

  http.post(
    `${BASE}/identity/provider/secret:rotate`,
    async ({ params, request }) => {
      const body = (await request.json()) as { clientSecret?: string };
      if (!body.clientSecret) {
        return humaError(422, "validation failed (clientSecret is required)");
      }
      if (!rotateIdpSecretMock(params.org as string, body.clientSecret)) {
        return humaError(404, "no identity provider configured");
      }
      return new HttpResponse(null, { status: 204 });
    },
  ),

  http.delete(`${BASE}/identity/provider`, ({ params }) => {
    if (!deleteIdpProviderMock(params.org as string)) {
      return humaError(404, "no identity provider configured");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.put(`${BASE}/identity/provider/domains`, async ({ params, request }) => {
    const body = (await request.json()) as { domainHints?: string[] };
    if (!Array.isArray(body.domainHints)) {
      return humaError(422, "validation failed (domainHints must be an array)");
    }
    const org = params.org as string;
    if (!idpProviderFor(org))
      return humaError(404, "no identity provider configured");
    const conflict = domainClaimConflict(org, body.domainHints);
    if (conflict) {
      return humaError(
        409,
        `domain "${conflict}" is already claimed by another organization`,
      );
    }
    return HttpResponse.json({
      provider: putDomainHintsMock(org, body.domainHints),
    });
  }),

  http.put(
    `${BASE}/identity/clients/:id/scopes`,
    async ({ params, request }) => {
      const body = (await request.json()) as { scopes?: string[] };
      if (!Array.isArray(body.scopes)) {
        return humaError(422, "validation failed (scopes must be an array)");
      }
      const client = putClientScopesMock(
        params.org as string,
        params.id as string,
        body.scopes,
      );
      if (!client) return humaError(404, "client not found");
      return HttpResponse.json({ client });
    },
  ),

  // ---- M6.W3: approvals configuration (proposed routes) ----
  http.get(`${BASE}/approval-config`, ({ params }) =>
    HttpResponse.json({ config: approvalConfigFor(params.org as string) }),
  ),

  http.put(`${BASE}/approval-config`, async ({ params, request }) => {
    const body = (await request.json()) as {
      thresholds?: { action: string; approvalsRequired: number }[];
      approverGroups?: string[];
      autoApproveRules?: { action: string; condition: string }[];
    };
    if (!body.thresholds || !body.approverGroups || !body.autoApproveRules) {
      return humaError(
        422,
        "validation failed (thresholds, approverGroups, autoApproveRules are required)",
      );
    }
    return HttpResponse.json({
      config: putApprovalConfigMock(params.org as string, {
        thresholds: body.thresholds,
        approverGroups: body.approverGroups,
        autoApproveRules: body.autoApproveRules,
      }),
    });
  }),

  // ---- M6.W4: ESO secret-store registry ----
  http.get(`${BASE}/secret-stores`, ({ params }) =>
    HttpResponse.json({ stores: secretStoresFor(params.org as string) }),
  ),

  http.post(`${BASE}/secret-stores`, async ({ params, request }) => {
    const body = (await request.json()) as CreateSecretStoreInput;
    if (!body.name) {
      return humaError(422, "validation failed (name is required)");
    }
    if (findSecretStore(params.org as string, body.name)) {
      return humaError(409, `secret store "${body.name}" already exists`);
    }
    const store = createSecretStoreMock(params.org as string, body);
    return HttpResponse.json({ store }, { status: 201 });
  }),

  http.patch(`${BASE}/secret-stores/:name`, async ({ params, request }) => {
    const existing = findSecretStore(
      params.org as string,
      params.name as string,
    );
    if (!existing) return humaError(404, "secret store not found");
    // Platform-scope writes require superuser (design §3.2).
    if (existing.scope === "platform") {
      return humaError(403, "platform-scoped secret stores are read-only");
    }
    const body = (await request.json()) as UpdateSecretStoreInput;
    const store = updateSecretStoreMock(
      params.org as string,
      params.name as string,
      body,
    );
    return HttpResponse.json({ store });
  }),

  http.delete(`${BASE}/secret-stores/:name`, ({ params }) => {
    const existing = findSecretStore(
      params.org as string,
      params.name as string,
    );
    if (!existing) return humaError(404, "secret store not found");
    if (existing.scope === "platform") {
      return humaError(403, "platform-scoped secret stores are read-only");
    }
    deleteSecretStoreMock(params.org as string, params.name as string);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/secret-stores/:name/status`, ({ params }) => {
    const status = secretStoreStatusFor(
      params.org as string,
      params.name as string,
    );
    if (!status) return humaError(404, "secret store not found");
    return HttpResponse.json({ status });
  }),

  // ---- Notification endpoints (inari-server internal/notifications) ----
  http.get(`${BASE}/notification-endpoints`, ({ params }) =>
    HttpResponse.json({
      endpoints: notificationEndpointsFor(params.org as string),
    }),
  ),

  http.post(`${BASE}/notification-endpoints`, async ({ params, request }) => {
    const body = (await request.json()) as NotificationEndpointInput;
    const err = validateEndpointInput(body, true);
    if (err) return humaError(422, err);
    const endpoint = createNotificationEndpointMock(params.org as string, body);
    return HttpResponse.json({ endpoint });
  }),

  http.put(
    `${BASE}/notification-endpoints/:id`,
    async ({ params, request }) => {
      const existing = findNotificationEndpoint(
        params.org as string,
        params.id as string,
      );
      if (!existing) return humaError(404, "notification endpoint not found");
      const body = (await request.json()) as NotificationEndpointInput;
      const merged = { ...existing, ...body };
      const err = validateEndpointInput(merged, false);
      if (err) return humaError(422, err);
      const endpoint = updateNotificationEndpointMock(
        params.org as string,
        params.id as string,
        body,
      );
      return HttpResponse.json({ endpoint });
    },
  ),

  http.delete(`${BASE}/notification-endpoints/:id`, ({ params }) => {
    if (
      !deleteNotificationEndpointMock(params.org as string, params.id as string)
    ) {
      return humaError(404, "notification endpoint not found");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/notification-endpoints/:id/test`, ({ params }) => {
    const endpoint = findNotificationEndpoint(
      params.org as string,
      params.id as string,
    );
    if (!endpoint) return humaError(404, "notification endpoint not found");
    return HttpResponse.json({
      delivery: {
        id: `nd-${Date.now()}`,
        endpointId: endpoint.id,
        eventType: "notification.test",
        payload: {},
        status: "delivered",
        attempts: 1,
        createdAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
      },
    });
  }),
];

// Mirrors validateEndpoint in inari-server internal/notifications.
const KNOWN_EVENTS = new Set([
  "approval.requested",
  "approval.decided",
  "approval.cancelled",
  "approval.expired",
  "capabilities.ingested",
  "instance.status",
  "deploy.requested",
  "instance.upgraded",
  "drift.detected",
  "drift.resolved",
  "rollout.failed",
  "rollout.completed",
  "rollout.rolled_back",
  "extension.state_changed",
  "scaffold.completed",
  "scaffold.failed",
]);

function validateEndpointInput(
  body: NotificationEndpointInput,
  requireAll: boolean,
): string | null {
  if (requireAll || body.name !== undefined) {
    if (!body.name) return "validation failed (name is required)";
  }
  if (requireAll || body.kind !== undefined) {
    if (body.kind !== "slack" && body.kind !== "webhook") {
      return "validation failed (kind must be slack or webhook)";
    }
  }
  if (requireAll || body.url !== undefined) {
    if (!body.url || !/^https?:\/\//.test(body.url)) {
      return "validation failed (url must be an http(s) URL)";
    }
    if (body.kind === "slack" && body.url && !body.url.startsWith("https://")) {
      return "validation failed (slack endpoints must use https)";
    }
  }
  for (const e of body.events ?? []) {
    if (!KNOWN_EVENTS.has(e)) return "validation failed (unknown event type in events filter)";
  }
  return null;
}

interface CreateZoneRequestBody {
  slug: string;
  displayName: string;
  ouId: string;
  managementAccountId: string;
  region: string;
  tier: string;
  tags?: Record<string, string>;
}
