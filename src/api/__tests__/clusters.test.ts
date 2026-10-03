import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/client";
import {
  approveCluster,
  cordonCluster,
  decommissionCluster,
  downloadKubeconfig,
  getAccessInfo,
  revokeCluster,
  uncordonCluster,
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

describe("cluster access api", () => {
  it("gets OIDC access info for a cluster", async () => {
    const info = await getAccessInfo("tok", "cl-kind-dev");
    expect(info.kubectlAccessEnabled).toBe(true);
    expect(info.tunnelAvailable).toBe(true);
    expect(info.proxyUrl).toBe("https://kubeproxy.inari.test");
    expect(info.organization).toBe("acme");
  });

  it("surfaces 404 for unknown clusters", async () => {
    await expect(getAccessInfo("tok", "cl-nope")).rejects.toMatchObject({ status: 404 });
  });

  function stubDownloadDom() {
    const anchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
    const origCreate = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation(((tag: string, options?: ElementCreationOptions) =>
        tag === "a" ? anchor : origCreate(tag, options)) as typeof document.createElement);
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    return { anchor, createSpy, createObjectURL, revokeObjectURL };
  }

  it("downloads a kubeconfig with mode/server query params and the server filename", async () => {
    let seenUrl: string | null = null;
    let seenAuth: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters/cl-kind-dev/kubeconfig", ({ request }) => {
        seenUrl = request.url;
        seenAuth = request.headers.get("authorization");
        return new HttpResponse("apiVersion: v1\n", {
          headers: {
            "Content-Type": "application/yaml",
            "Content-Disposition": 'attachment; filename="kind-dev.yaml"',
          },
        });
      }),
    );
    const { anchor, createSpy, revokeObjectURL } = stubDownloadDom();

    await downloadKubeconfig("my-token", "cl-kind-dev", {
      mode: "direct",
      server: "https://api.example.com",
    });

    const url = new URL(seenUrl!);
    expect(url.searchParams.get("mode")).toBe("direct");
    expect(url.searchParams.get("server")).toBe("https://api.example.com");
    expect(seenAuth).toBe("Bearer my-token");
    expect(anchor.download).toBe("kind-dev.yaml");
    expect(anchor.click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    createSpy.mockRestore();
  });

  it("falls back to a derived filename when Content-Disposition is missing", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters/cl-kind-dev/kubeconfig", () =>
        new HttpResponse("apiVersion: v1\n", {
          headers: { "Content-Type": "application/yaml" },
        }),
      ),
    );
    const { anchor, createSpy } = stubDownloadDom();

    await downloadKubeconfig("tok", "cl-kind-dev", { mode: "gateway" });
    expect(anchor.download).toBe("kubeconfig-cl-kind-dev.yaml");
    createSpy.mockRestore();
  });

  it("surfaces server errors as ApiError", async () => {
    await expect(
      downloadKubeconfig("tok", "cl-nope", { mode: "gateway" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("cluster lifecycle api", () => {
  it("maps the new server states to UI statuses", () => {
    expect(clusterHealth("pending_approval")).toBe("pending_approval");
    expect(clusterHealth("cordoned")).toBe("cordoned");
    expect(clusterHealth("revoked")).toBe("revoked");
    expect(clusterHealth("decommissioned")).toBe("decommissioned");
  });

  it("approves a pending-approval cluster", async () => {
    mockControl.setClusterStatus("cl-kind-dev", "pending_approval");
    const cluster = await approveCluster("tok", "cl-kind-dev");
    expect(cluster.status).toBe("connected");
  });

  it("cordons and uncordons a cluster", async () => {
    expect((await cordonCluster("tok", "cl-kind-dev")).status).toBe("cordoned");
    expect((await uncordonCluster("tok", "cl-kind-dev")).status).toBe("connected");
  });

  it("revokes a cluster (204, no body)", async () => {
    await revokeCluster("tok", "cl-kind-dev");
    expect(mockControl.getState().clusters.find((c) => c.id === "cl-kind-dev")?.status).toBe(
      "revoked",
    );
  });

  it("decommissions a cluster and returns drained instance IDs", async () => {
    mockControl.setDecommissionDrain("cl-kind-dev", ["ri-a", "ri-b"]);
    const res = await decommissionCluster("tok", "cl-kind-dev");
    expect(res.cluster.status).toBe("decommissioned");
    expect(res.drainedInstanceIds).toEqual(["ri-a", "ri-b"]);
  });

  it("surfaces 409 shared-resources on decommission and succeeds with force", async () => {
    mockControl.setDecommissionBlocked("cl-kind-dev", true);
    await expect(decommissionCluster("tok", "cl-kind-dev")).rejects.toMatchObject({
      status: 409,
    });
    const res = await decommissionCluster("tok", "cl-kind-dev", { force: true });
    expect(res.cluster.status).toBe("decommissioned");
  });

  it("returns 404 for unknown clusters", async () => {
    await expect(approveCluster("tok", "cl-nope")).rejects.toMatchObject({ status: 404 });
  });
});
