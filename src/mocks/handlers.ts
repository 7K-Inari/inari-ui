import { http, HttpResponse } from "msw";

import {
  capabilitiesFor,
  findCluster,
  listForTenant,
  registerCluster,
} from "@/mocks/fixtures";
import type { CreateClusterRequest } from "@/api/types";

const BASE = "*/api/v1";

export const handlers = [
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
