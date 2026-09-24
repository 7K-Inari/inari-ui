import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadExtension, resolveRemoteEntryUrl } from "@/ext/load-extension";
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

describe("loadExtension entryGlobalName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
