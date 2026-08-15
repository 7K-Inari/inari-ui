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
import type { CreateClusterRequest, CreateDeployRequest } from "@/api/types";

const BASE = "*/api/v1";

export const handlers = [
  http.get(`${BASE}/catalog/items`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      listCatalogItemsFiltered({
        source: url.searchParams.get("source"),
        category: url.searchParams.get("category"),
        clusterId: url.searchParams.get("clusterId"),
      }),
    );
  }),

  http.get(`${BASE}/catalog/items/:id`, ({ params }) => {
    const item = findCatalogItem(params.id as string);
    if (!item) {
      return HttpResponse.json({ message: "catalog item not found" }, { status: 404 });
    }
    return HttpResponse.json(item);
  }),

  http.post(`${BASE}/deploys`, async ({ request }) => {
    const url = new URL(request.url);
    const tenant = url.searchParams.get("tenant");
    if (!tenant) {
      return HttpResponse.json(
        { message: "tenant query parameter is required" },
        { status: 400 },
      );
    }
    const body = (await request.json()) as CreateDeployRequest;
    if (!body.itemId || !findCatalogItem(body.itemId)) {
      return HttpResponse.json({ message: "unknown catalog item" }, { status: 400 });
    }
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return HttpResponse.json(
        { message: "name must be lowercase alphanumeric with dashes" },
        { status: 400 },
      );
    }
    return HttpResponse.json(createDeployMock(tenant, body), { status: 201 });
  }),

  http.get(`${BASE}/deploys/:id`, ({ params }) => {
    const deploy = pollDeployMock(params.id as string);
    if (!deploy) {
      return HttpResponse.json({ message: "deploy not found" }, { status: 404 });
    }
    return HttpResponse.json(deploy);
  }),

  http.get(`${BASE}/resources`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(listResourcesForTenant(url.searchParams.get("tenant")));
  }),

  http.get(`${BASE}/resources/:id`, ({ params }) => {
    const resource = findResource(params.id as string);
    if (!resource) {
      return HttpResponse.json({ message: "resource not found" }, { status: 404 });
    }
    return HttpResponse.json(resource);
  }),

  http.get(`${BASE}/resources/:id/upgrade-diff`, ({ params, request }) => {
    const url = new URL(request.url);
    const diff = upgradeDiffFor(params.id as string, url.searchParams.get("to") ?? "");
    if (!diff) {
      return HttpResponse.json({ message: "resource not found" }, { status: 404 });
    }
    return HttpResponse.json(diff);
  }),

  http.post(`${BASE}/resources/:id/upgrade`, async ({ params, request }) => {
    const body = (await request.json()) as { to?: string };
    const deploy = upgradeResourceMock(params.id as string, body.to ?? "");
    if (!deploy) {
      return HttpResponse.json({ message: "resource not found" }, { status: 404 });
    }
    return HttpResponse.json(deploy, { status: 201 });
  }),

  http.get(`${BASE}/clusters`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(listForTenant(url.searchParams.get("tenant")));
  }),

  http.post(`${BASE}/clusters`, async ({ request }) => {
    const url = new URL(request.url);
    const tenant = url.searchParams.get("tenant");
    if (!tenant) {
      return HttpResponse.json(
        { message: "tenant query parameter is required" },
        { status: 400 },
      );
    }
    const body = (await request.json()) as CreateClusterRequest;
    if (!body.name || !/^[a-z0-9][a-z0-9-]*$/.test(body.name)) {
      return HttpResponse.json(
        { message: "name must be lowercase alphanumeric with dashes" },
        { status: 400 },
      );
    }
    return HttpResponse.json(registerCluster(tenant, body), { status: 201 });
  }),

  http.get(`${BASE}/clusters/:id`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) {
      return HttpResponse.json({ message: "cluster not found" }, { status: 404 });
    }
    return HttpResponse.json(cluster);
  }),

  http.get(`${BASE}/clusters/:id/capabilities`, ({ params }) => {
    const caps = capabilitiesFor(params.id as string);
    if (!caps) {
      return HttpResponse.json({ message: "cluster not found" }, { status: 404 });
    }
    return HttpResponse.json(caps);
  }),

  http.get(`${BASE}/clusters/:id/install-manifest`, ({ params }) => {
    const cluster = findCluster(params.id as string);
    if (!cluster) {
      return HttpResponse.json({ message: "cluster not found" }, { status: 404 });
    }
    return new HttpResponse(
      `# install manifest for ${cluster.name}\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: inari-system\n`,
      { headers: { "content-type": "text/yaml" } },
    );
  }),
];
