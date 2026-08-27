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
import { setCurrentTenant } from "@/tenant/current";
import { config } from "@/config";

beforeAll(() => {
  setCurrentTenant("acme"); // detail helpers fall back to the active tenant
  mockServer.listen({ onUnhandledRequest: "error" });
});
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

  it("rejects the all-tenants scope (server endpoints are tenant-scoped)", async () => {
    await expect(listClusters("tok", "all")).rejects.toThrow(/tenant/i);
  });

  it("sends the bearer token", async () => {
    let seen: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters", ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ clusters: [] });
      }),
    );
    await listClusters("my-token", "acme");
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
    const manifest = await getInstallManifest("tok", res.cluster.id, "acme");
    expect(manifest).toContain(res.registrationToken);

    const helm = res.install.helmCommand!;
    expect(helm).toContain("helm install inari-agent oci://ghcr.io/7k-inari/charts/inari-agent");
    expect(helm).toContain(`--set registration.token=${res.registrationToken}`);
    expect(helm).toContain("--set tenant.slug=acme");
    expect(helm).toContain(`--set agent.gatewayUrl=${config.agentGatewayUrl}`);
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
