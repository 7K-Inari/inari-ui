import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { listTenantPlatformResources } from "@/api/platform";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

describe("platform api", () => {
  it("lists tenant platform resources from the contract envelope", async () => {
    const resources = await listTenantPlatformResources("tok", "acme");
    expect(resources.length).toBeGreaterThan(0);
    expect(resources[0]).toHaveProperty("id");
    expect(resources[0]).toHaveProperty("kind");
    expect(resources[0]).toHaveProperty("updatedAt");
  });

  it("returns an empty array when the server sends null resources", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/platform-resources", () =>
        HttpResponse.json({ resources: null }),
      ),
    );
    await expect(listTenantPlatformResources("tok", "acme")).resolves.toEqual(
      [],
    );
  });

  it("resolves the current tenant into the request path", async () => {
    let seenPath = "";
    mockServer.use(
      http.get("*/api/v1/tenants/:org/platform-resources", ({ request }) => {
        seenPath = new URL(request.url).pathname;
        return HttpResponse.json({ resources: [] });
      }),
    );
    await listTenantPlatformResources("tok", "acme");
    expect(seenPath).toBe("/api/v1/tenants/acme/platform-resources");
  });
});
