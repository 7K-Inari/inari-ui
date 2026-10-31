import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  adoptAddon,
  enableAddonPrune,
  listClusterAddons,
  partitionAddons,
  updateAddon,
} from "@/api/addons";
import { ApiError } from "@/api/client";
import { addonsMockControl } from "@/mocks/fixtures/addons";
import { gitReposMockControl } from "@/mocks/fixtures/git-repos";
import { mockServer } from "@/mocks/server";
import { setCurrentTenant } from "@/tenant/current";

beforeAll(() => {
  setCurrentTenant("acme"); // detail helpers fall back to the active tenant
  mockServer.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  mockServer.resetHandlers();
  addonsMockControl.reset();
  gitReposMockControl.reset();
});
afterAll(() => mockServer.close());

describe("addons api", () => {
  it("lists managed, fleet, and discovered addons for a cluster", async () => {
    const addons = await listClusterAddons("tok", "cl-kind-dev", "acme");
    const { managed, discovered } = partitionAddons(addons);

    expect(managed.map((a) => a.catalogItem).sort()).toEqual([
      "cat-argocd", // fleet row (clusterId "*", selector env=dev matches)
      "cat-cert-manager",
      "cat-external-dns",
      "cat-external-secrets",
      "cat-istio",
      "cat-monitoring-stack", // fleet row (clusterId "*", selector env=dev matches)
    ]);
    expect(discovered.map((a) => a.catalogItem).sort()).toEqual([
      "cat-ingress-nginx",
      "cat-metrics-server",
    ]);

    const certManager = managed.find((a) => a.id === "addon-cert-manager")!;
    expect(certManager.availableVersions).toContain("1.16.1");
    expect(certManager.pruneEnabled).toBe(false);
    expect(certManager.commitSha).toMatch(/^[0-9a-f]{40}$/);

    const fleet = managed.find((a) => a.id === "addon-monitoring")!;
    expect(fleet.isFleet).toBe(true);
    expect(fleet.clusterSelector).toEqual({ env: "dev" });

    const eso = managed.find((a) => a.id === "addon-external-secrets")!;
    expect(eso.prUrl).toContain("github.com");
    expect(eso.pruneEnabled).toBe(true);

    const metrics = discovered.find((a) => a.id === "addon-disc-metrics-server")!;
    expect(metrics.discovered).toEqual({
      releaseName: "metrics-server",
      namespace: "kube-system",
      detectedVersion: "3.12.1",
      chart: "metrics-server",
    });
  });

  it("sends the bearer token", async () => {
    let seen: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters/cl-kind-dev/addons", ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ addons: [] });
      }),
    );
    await listClusterAddons("my-token", "cl-kind-dev", "acme");
    expect(seen).toBe("Bearer my-token");
  });

  it("adopts a discovered addon into the baseline repo (direct policy → commitSha)", async () => {
    const res = await adoptAddon(
      "tok",
      "cl-kind-dev",
      "cat-metrics-server",
      { version: "3.12.1", values: { replicas: 2 }, deployMode: "application" },
      "acme",
    );
    expect(res.addon.state).toBe("managed");
    expect(res.addon.deployMode).toBe("application");
    expect(res.addon.repoId).toBe("repo-baseline"); // default baseline
    expect(res.addon.argocdApp).toMatch(/^inari-addon-/);
    expect(res.addon.pruneEnabled).toBe(false); // decision 2
    expect(res.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(res.prUrl).toBeNull();
  });

  it("adopts fleet-wide into a PR-policy repo (pull_request → prUrl, selector passed through)", async () => {
    const res = await adoptAddon(
      "tok",
      "cl-kind-dev",
      "cat-ingress-nginx",
      {
        repoId: "repo-team-alpha",
        deployMode: "applicationset",
        clusterSelector: { env: "dev" },
        namespace: "ingress-nginx",
      },
      "acme",
    );
    expect(res.addon.deployMode).toBe("applicationset");
    expect(res.addon.clusterId).toBe("*"); // fleet rows move off the cluster id
    expect(res.addon.isFleet).toBe(true);
    expect(res.addon.argocdApp).toMatch(/^inari-addonset-/);
    expect(res.addon.clusterSelector).toEqual({ env: "dev" });
    expect(res.prUrl).toContain("github.com");
    expect(res.commitSha).toBeNull();
  });

  it("returns 409 when adopting an already-managed addon", async () => {
    const err = await adoptAddon("tok", "cl-kind-dev", "cat-cert-manager", {}, "acme").catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
  });

  it("returns 422 for a fleet adopt whose selector matches no clusters", async () => {
    const err = await adoptAddon(
      "tok",
      "cl-kind-dev",
      "cat-metrics-server",
      { deployMode: "applicationset", clusterSelector: { env: "does-not-exist" } },
      "acme",
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
  });

  it("updates version and values via PATCH", async () => {
    const res = await updateAddon(
      "tok",
      "addon-cert-manager",
      { chartVersion: "1.16.1", values: { enableHA: false } },
      "acme",
    );
    expect(res.addon.chartVersion).toBe("1.16.1");
    expect(res.addon.values).toEqual({ enableHA: false });
    expect(res.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("returns a PR URL when the addon's repo uses pull_request policy", async () => {
    const res = await updateAddon("tok", "addon-external-secrets", { chartVersion: "0.9.20" });
    expect(res.prUrl).toContain("github.com");
  });

  it("rejects an empty PATCH body with 422", async () => {
    const err = await updateAddon("tok", "addon-cert-manager", {}, "acme").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
  });

  it("enables prune, then conflicts on a second enable", async () => {
    const res = await enableAddonPrune("tok", "addon-cert-manager", "acme");
    expect(res.addon.pruneEnabled).toBe(true);

    const err = await enableAddonPrune("tok", "addon-cert-manager", "acme").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
  });

  it("returns 404 for an unknown addon", async () => {
    const err = await updateAddon("tok", "addon-nope", { chartVersion: "1.0.0" }, "acme").catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
  });
});
