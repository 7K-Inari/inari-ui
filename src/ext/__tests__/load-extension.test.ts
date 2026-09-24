import { describe, expect, it } from "vitest";

import { containerName, resolveRemoteEntryUrl } from "@/ext/load-extension";

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

describe("containerName", () => {
  // RUNTIME-001 regression: the registry name (dashes) is not the webpack
  // container global (underscores); the MF runtime resolves by registered name.
  it("derives the webpack container global from the registry name", () => {
    expect(containerName("inari-ext-argocd")).toBe("inari_ext_argocd");
    expect(containerName("plainname")).toBe("plainname");
    expect(containerName("my.ext-name_v2")).toBe("my_ext_name_v2");
  });
});
