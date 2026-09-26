import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ApiError } from "@/api/client";
import {
  getAccessInfo,
  updateClusterSettings,
  clusterHealth,
  createCluster,
  deleteCluster,
  getCapabilities,
  getCluster,
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

describe("clusterHealth", () => {
  it("maps server states to UI statuses", () => {
    expect(clusterHealth("active")).toBe("connected");
    expect(clusterHealth("degraded")).toBe("degraded");
    expect(clusterHealth("pending_registration")).toBe("pending");
    expect(clusterHealth("unreachable")).toBe("disconnected");
  });
});

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

    const helm = res.install.helmCommand;
    expect(helm).toContain("helm install inari-agent oci://ghcr.io/7k-inari/charts/inari-agent");
    expect(helm).toContain(`--set config.registrationToken=${res.registrationToken}`);
    expect(helm).toContain("--set config.tenantID=acme");
    expect(helm).toContain(`--set config.controlPlane=${config.agentGatewayUrl}`);
  });

  it("sends only huma-accepted properties on create (name+labels)", async () => {
    let seenBody: unknown = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.post("*/api/v1/tenants/acme/clusters", async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json(
          {
            cluster: {
              id: "cl-stub",
              orgId: "acme",
              name: "kind-m1",
              state: "pending_registration",
              createdAt: new Date().toISOString(),
            },
          },
          { status: 201 },
        );
      }),
      http.post("*/api/v1/tenants/acme/clusters/cl-stub/tokens", () =>
        HttpResponse.json({
          token: "inari-reg-stub-token",
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        }),
      ),
    );
    await createCluster("tok", "acme", { name: "kind-m1", labels: { env: "dev" } });
    // The cluster-registry huma schema rejects any other property with
    // 422 "validation failed (unexpected property …)" — keep this exact.
    expect(seenBody).toEqual({ name: "kind-m1", labels: { env: "dev" } });
  });

  it("surfaces server validation errors as ApiError", async () => {
    await expect(
      createCluster("tok", "acme", { name: "Bad_Name", labels: {} }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/name/) });
  });

  it("gets a cluster detail by id", async () => {
    const cluster = await getCluster("tok", "cl-kind-dev");
    expect(cluster.name).toBe("kind-dev");
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

  it("deletes a pending cluster", async () => {
    mockControl.setClusterStatus("cl-eks-prod", "pending");
    await deleteCluster("tok", "cl-eks-prod", "acme");
    const clusters = await listClusters("tok", "acme");
    expect(clusters.map((c) => c.id)).not.toContain("cl-eks-prod");
  });

  it("rejects deleting a cluster that is not pending", async () => {
    const err = await deleteCluster("tok", "cl-kind-dev", "acme").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
  });

  it("surfaces 404 when deleting an unknown cluster", async () => {
    const err = await deleteCluster("tok", "cl-nope", "acme").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });
});

describe("kubectl-proxy access", () => {
  it("getCluster carries the server-computed effective enablement", async () => {
    const cluster = await getCluster("tok", "cl-kind-dev");
    expect(cluster.kubectlProxyDisabled).toBe(false);
    expect(cluster.kubectlProxyEnabled).toBe(true);
  });

  it("getCluster reflects per-cluster disable", async () => {
    mockControl.setClusterKubectlProxyDisabled("cl-kind-dev", true);
    const cluster = await getCluster("tok", "cl-kind-dev");
    expect(cluster.kubectlProxyDisabled).toBe(true);
    expect(cluster.kubectlProxyEnabled).toBe(false);
  });

  it("getCluster reflects the global kill switch", async () => {
    mockControl.setKubectlProxyEnabled(false);
    const cluster = await getCluster("tok", "cl-kind-dev");
    expect(cluster.kubectlProxyDisabled).toBe(false);
    expect(cluster.kubectlProxyEnabled).toBe(false);
  });

  it("getAccessInfo returns the kubelogin kubeconfig inputs", async () => {
    const info = await getAccessInfo("tok", "cl-kind-dev");
    expect(info.issuerUrl).toContain("keycloak");
    expect(info.kubectlClientId).toBe("acme-kubectl");
    expect(info.audience).toBe("kubernetes");
    expect(info.organization).toBe("acme");
  });

  it("updateClusterSettings PATCHes the per-cluster disable flag", async () => {
    let seenBody: unknown = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.patch("*/api/v1/tenants/acme/clusters/cl-kind-dev", async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json({
          cluster: {
            id: "cl-kind-dev",
            orgId: "acme",
            name: "kind-dev",
            state: "active",
            kubectlProxyDisabled: true,
            createdAt: new Date().toISOString(),
          },
          kubectlProxyEnabled: false,
        });
      }),
    );
    const updated = await updateClusterSettings("tok", "cl-kind-dev", true);
    expect(seenBody).toEqual({ kubectlProxyDisabled: true });
    expect(updated.kubectlProxyDisabled).toBe(true);
    expect(updated.kubectlProxyEnabled).toBe(false);
  });

  it("updateClusterSettings round-trips through the mock backend", async () => {
    const updated = await updateClusterSettings("tok", "cl-kind-dev", true);
    expect(updated.kubectlProxyDisabled).toBe(true);
    expect(updated.kubectlProxyEnabled).toBe(false);
    const fetched = await getCluster("tok", "cl-kind-dev");
    expect(fetched.kubectlProxyDisabled).toBe(true);
  });
});
