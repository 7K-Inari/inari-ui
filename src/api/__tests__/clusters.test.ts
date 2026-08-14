import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ApiError } from "@/api/client";
import {
  createCluster,
  getCapabilities,
  getCluster,
  getInstallManifest,
  listClusters,
} from "@/api/clusters";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

describe("clusters api", () => {
  it("lists clusters scoped to a tenant", async () => {
    const clusters = await listClusters("tok", "acme");
    expect(clusters.map((c) => c.tenant)).toEqual(["acme", "acme"]);
  });

  it("lists all clusters for the all-tenants view", async () => {
    const clusters = await listClusters("tok", "all");
    expect(clusters).toHaveLength(3);
  });

  it("sends the bearer token", async () => {
    let seen: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/clusters", ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json([]);
      }),
    );
    await listClusters("my-token", "all");
    expect(seen).toBe("Bearer my-token");
  });

  it("creates a cluster and returns a one-time token with install instructions", async () => {
    const res = await createCluster("tok", "acme", {
      name: "kind-m1",
      labels: { env: "dev" },
    });
    expect(res.cluster.status).toBe("pending");
    expect(res.cluster.tenant).toBe("acme");
    expect(res.registrationToken).toMatch(/^inari-reg-/);
    expect(new Date(res.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.install.manifestYaml).toContain(res.registrationToken);
    expect(res.install.helmCommand).toContain("kind-m1");
  });

  it("surfaces server validation errors as ApiError", async () => {
    await expect(
      createCluster("tok", "acme", { name: "Bad_Name", labels: {} }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/name/) });
  });

  it("gets a cluster detail by id", async () => {
    const cluster = await getCluster("tok", "cl-kind-dev");
    expect(cluster.name).toBe("kind-dev");
    expect(cluster.agentVersion).toBe("0.3.1");
  });

  it("throws ApiError with server message on 404", async () => {
    const err = await getCluster("tok", "nope").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("cluster not found");
  });

  it("gets capabilities for a cluster", async () => {
    const caps = await getCapabilities("tok", "cl-kind-dev");
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.map((c) => c.kind)).toContain("kro-rgd");
  });

  it("fetches the install manifest as text", async () => {
    const manifest = await getInstallManifest("tok", "cl-kind-dev");
    expect(manifest).toContain("kind: Namespace");
  });
});
