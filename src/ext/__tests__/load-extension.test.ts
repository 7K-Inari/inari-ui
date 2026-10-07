import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRemoteEntryHealth,
  ExtensionLoadError,
  loadExtension,
  resolveRemoteEntryUrl,
} from "@/ext/load-extension";
import { argocdExtension, argocdRemote } from "@/mocks/fixtures/extensions";

describe("resolveRemoteEntryUrl", () => {
  it("keeps absolute URLs as-is", () => {
    expect(resolveRemoteEntryUrl("https://cdn.example.com/remoteEntry.js")).toBe(
      "https://cdn.example.com/remoteEntry.js",
    );
  });

  it("absolutizes the server-served registry path against the API origin", () => {
    // default API_BASE_URL is the relative "/api/v1"
    expect(
      resolveRemoteEntryUrl("/api/v1/tenants/acme/extensions/ui/argocd/remoteEntry.js"),
    ).toBe(
      `${window.location.origin}/api/v1/tenants/acme/extensions/ui/argocd/remoteEntry.js`,
    );
  });
});

const registerRemotes = vi.fn();
const loadRemote = vi.fn();

vi.mock("@/ext/host-runtime", () => ({
  getHostRuntime: () => ({ registerRemotes, loadRemote }),
}));

const okFetch = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("// remoteEntry", { status: 200 })),
  );

describe("loadExtension entryGlobalName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    okFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps the dashed registry name to the webpack container global", async () => {
    loadRemote.mockResolvedValue(argocdExtension);
    await loadExtension(argocdRemote);
    expect(registerRemotes).toHaveBeenCalledWith([
      {
        name: "inari-ext-argocd",
        entry: `${window.location.origin}/extensions/inari-ext-argocd/remoteEntry.js`,
        entryGlobalName: "inari_ext_argocd",
      },
    ]);
    expect(loadRemote).toHaveBeenCalledWith("inari-ext-argocd/extension");
  });

  it("leaves identifier-safe names unchanged", async () => {
    loadRemote.mockResolvedValue(argocdExtension);
    await loadExtension({ ...argocdRemote, name: "plain" });
    expect(registerRemotes).toHaveBeenCalledWith([
      expect.objectContaining({ name: "plain", entryGlobalName: "plain" }),
    ]);
  });
});

describe("loadExtension remoteEntry preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const entryUrl = `${window.location.origin}/extensions/inari-ext-argocd/remoteEntry.js`;

  it("throws ExtensionLoadError with status and server detail on HTTP 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "Bad Gateway",
            status: 502,
            detail: "upstream connect error or disconnect/reset before headers",
          }),
          { status: 502, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const err = await loadExtension(argocdRemote).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExtensionLoadError);
    const loadErr = err as ExtensionLoadError;
    expect(loadErr.status).toBe(502);
    expect(loadErr.entryUrl).toBe(entryUrl);
    expect(loadErr.message).toContain("502");
    expect(loadErr.message).toContain("upstream connect error");
    expect(loadErr.message).toContain(entryUrl);
    expect(registerRemotes).not.toHaveBeenCalled();
  });

  it("surfaces the network error message and cause when fetch rejects", async () => {
    const network = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(network));
    const err = await loadExtension(argocdRemote).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExtensionLoadError);
    const loadErr = err as ExtensionLoadError;
    expect(loadErr.entryUrl).toBe(entryUrl);
    expect(loadErr.message).toContain("fetch failed");
    expect(loadErr.cause).toBe(network);
    expect(registerRemotes).not.toHaveBeenCalled();
  });

  it("wraps loadRemote failures with the entry URL", async () => {
    okFetch();
    loadRemote.mockRejectedValue(new Error("script error"));
    const err = await loadExtension(argocdRemote).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExtensionLoadError);
    expect((err as ExtensionLoadError).message).toContain(entryUrl);
    expect((err as ExtensionLoadError).message).toContain("script error");
  });
});

describe("checkRemoteEntryHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports healthy on a 200 response", async () => {
    okFetch();
    await expect(
      checkRemoteEntryHealth("/extensions/inari-ext-argocd/remoteEntry.js"),
    ).resolves.toEqual({ status: "healthy" });
  });

  it("reports unhealthy with an ExtensionLoadError on HTTP 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not found", { status: 404 })),
    );
    const health = await checkRemoteEntryHealth(
      "https://ext.example.com/remoteEntry.js",
    );
    expect(health.status).toBe("unhealthy");
    if (health.status !== "unhealthy") throw new Error("unreachable");
    expect(health.error).toBeInstanceOf(ExtensionLoadError);
    expect(health.error.status).toBe(404);
    expect(health.error.entryUrl).toBe("https://ext.example.com/remoteEntry.js");
  });

  it("reports unhealthy with the network cause when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const health = await checkRemoteEntryHealth(
      "https://ext.example.com/remoteEntry.js",
    );
    expect(health.status).toBe("unhealthy");
    if (health.status !== "unhealthy") throw new Error("unreachable");
    expect(health.error.message).toContain("fetch failed");
  });

  it("reports unhealthy when a 200 returns HTML (SPA fallback, not a remoteEntry)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html><title>Inari</title>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    );
    const health = await checkRemoteEntryHealth("/extensions/dead/remoteEntry.js");
    expect(health.status).toBe("unhealthy");
    if (health.status !== "unhealthy") throw new Error("unreachable");
    expect(health.error).toBeInstanceOf(ExtensionLoadError);
    expect(health.error.message).toContain("text/html");
    expect(health.error.message).toContain("/extensions/dead/remoteEntry.js");
  });

  it("reports unverifiable for an opaque (CORS-restricted) response", async () => {
    const opaque = new Response(null, { status: 200 });
    Object.defineProperty(opaque, "type", { value: "opaque" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(opaque));
    const health = await checkRemoteEntryHealth(
      "https://ext.example.com/remoteEntry.js",
    );
    expect(health.status).toBe("unverifiable");
  });
});
