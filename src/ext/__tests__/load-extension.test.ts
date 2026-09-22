import { describe, expect, it } from "vitest";

import { resolveRemoteEntryUrl } from "@/ext/load-extension";

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
