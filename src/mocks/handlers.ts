import { http, HttpResponse } from "msw";

import {
  capabilitiesFor,
  findCluster,
  listForTenant,
  registerCluster,
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
];
