import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { postExtensionSession } from "@/api/extension-session";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

describe("extension-session api", () => {
  it("posts session material to the extension-session endpoint", async () => {
    const { http, HttpResponse } = await import("msw");
    let seenAuth: string | null = null;
    let seenPath = "";
    let seenBody: unknown = null;
    mockServer.use(
      http.post("*/api/v1/tenants/:org/extensions/:id/session", async ({ request }) => {
        seenAuth = request.headers.get("authorization");
        seenPath = new URL(request.url).pathname;
        seenBody = await request.json();
        return HttpResponse.json({
          session: { extensionId: "ext-1", state: "active", expiresAt: "2026-01-01T01:00:00Z" },
        });
      }),
    );
    const session = await postExtensionSession("tok", "acme", "ext 1", {
      sessionMaterial: "material",
      nonce: "n-1",
    });
    expect(seenAuth).toBe("Bearer tok");
    expect(seenPath).toBe("/api/v1/tenants/acme/extensions/ext%201/session");
    expect(seenBody).toEqual({ sessionMaterial: "material", nonce: "n-1" });
    expect(session).toEqual({
      extensionId: "ext-1",
      state: "active",
      expiresAt: "2026-01-01T01:00:00Z",
    });
  });
});
