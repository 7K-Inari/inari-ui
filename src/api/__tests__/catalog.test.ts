import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { listCatalogItems } from "@/api/catalog";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";
import { setCurrentTenant } from "@/tenant/current";

beforeAll(() => {
  setCurrentTenant("acme");
  mockServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

async function captureQuery(): Promise<string> {
  let seen = "";
  const { http, HttpResponse } = await import("msw");
  mockServer.use(
    http.get("*/api/v1/tenants/acme/catalog", ({ request }) => {
      seen = new URL(request.url).search;
      return HttpResponse.json({ items: [], total: 0 });
    }),
  );
  await listCatalogItems("tok", "acme", {
    q: "post gre",
    source: "curated",
    category: "database",
    cluster: "cl-eks-prod",
    sort: "newest",
    limit: 24,
    offset: 48,
  });
  return seen;
}

describe("catalog api", () => {
  it("serializes filters into the server query params", async () => {
    const params = new URLSearchParams(await captureQuery());
    expect(params.get("q")).toBe("post gre");
    expect(params.get("source")).toBe("curated");
    expect(params.get("category")).toBe("database");
    expect(params.get("cluster")).toBe("cl-eks-prod");
    expect(params.get("sort")).toBe("newest");
    expect(params.get("limit")).toBe("24");
    expect(params.get("offset")).toBe("48");
  });

  it("omits empty filters and the default sort", async () => {
    let seen = "";
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/catalog", ({ request }) => {
        seen = new URL(request.url).search;
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    await listCatalogItems("tok", "acme", {});
    expect(seen).toBe("");
  });

  it("returns items with category and the server total", async () => {
    const res = await listCatalogItems("tok", "acme", { source: "curated" });
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].category).toBe("database");
    expect(res.items[0].createdAt).toBeTruthy();
  });
});
