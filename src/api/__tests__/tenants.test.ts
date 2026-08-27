import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ApiError } from "@/api/client";
import { createTenant } from "@/api/tenants";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

describe("tenants api", () => {
  it("creates a tenant and returns it", async () => {
    const tenant = await createTenant("tok", {
      slug: "initech",
      name: "Initech",
    });
    expect(tenant.slug).toBe("initech");
    expect(tenant.name).toBe("Initech");
  });

  it("sends the bearer token and JSON body", async () => {
    let seenAuth: string | null = null;
    let seenBody: unknown = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.post("*/api/v1/tenants", async ({ request }) => {
        seenAuth = request.headers.get("authorization");
        seenBody = await request.json();
        return HttpResponse.json(
          { tenant: { id: "t-1", slug: "x", name: "X" } },
          { status: 201 },
        );
      }),
    );
    await createTenant("my-token", { slug: "x", name: "X" });
    expect(seenAuth).toBe("Bearer my-token");
    expect(seenBody).toEqual({ slug: "x", name: "X" });
  });

  it("surfaces slug conflicts as ApiError 409", async () => {
    const err = await createTenant("tok", {
      slug: "taken",
      name: "Taken",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/already exists/i);
  });
});
