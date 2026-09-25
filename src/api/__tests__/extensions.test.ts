import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  addUiExtension,
  listBackendExtensions,
  listUiExtensions,
  removeUiExtension,
  rotateExtensionIdentity,
} from "@/api/extensions";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

describe("extensions api", () => {
  it("lists UI extensions and maps wire slots to view models", async () => {
    const remotes = await listUiExtensions("tok", "acme");
    expect(remotes.length).toBeGreaterThan(0);
    const [first] = remotes;
    expect(first).toMatchObject({
      name: expect.any(String),
      version: expect.any(String),
      remoteEntryUrl: expect.any(String),
      enabled: true,
    });
    for (const slot of first.slots) {
      expect(typeof slot.kind).toBe("string");
      expect(typeof slot.name).toBe("string");
    }
  });

  it("registers a UI extension remote", async () => {
    const remote = await addUiExtension("tok", "acme", {
      name: "inari-ext-test",
      remoteEntryUrl: "/extensions/inari-ext-test/remoteEntry.js",
    });
    expect(remote.name).toBe("inari-ext-test");
    expect(remote.slots).toEqual([]);
    expect(remote.enabled).toBe(true);
  });

  it("removes a UI extension remote", async () => {
    await expect(
      removeUiExtension("tok", "acme", "inari-ext-argocd"),
    ).resolves.toBeUndefined();
    const remotes = await listUiExtensions("tok", "acme");
    expect(remotes.some((r) => r.name === "inari-ext-argocd")).toBe(false);
  });

  it("maps backend registry state onto healthy (ready = healthy)", async () => {
    const extensions = await listBackendExtensions("tok", "acme");
    expect(extensions.length).toBeGreaterThan(0);
    const [first] = extensions;
    expect(first.id).toEqual(expect.any(String));
    expect(first.state).toBe("ready");
    expect(first.healthy).toBe(true);
  });

  it("marks non-ready backend extensions as unhealthy", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/:org/extensions", () =>
        HttpResponse.json({
          extensions: [
            {
              id: "ext-1",
              name: "degraded-ext",
              version: "1.0.0",
              kind: "backend",
              endpoint: "https://ext.example.com",
              checksum: "sha256:abc",
              state: "degraded",
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        }),
      ),
    );
    const [ext] = await listBackendExtensions("tok", "acme");
    expect(ext.state).toBe("degraded");
    expect(ext.healthy).toBe(false);
  });

  it("rotates an extension identity and returns the one-time secret", async () => {
    const credentials = await rotateExtensionIdentity("tok", "acme", "ext-argocd");
    expect(credentials.clientId).toEqual(expect.any(String));
    expect(credentials.secret).toEqual(expect.any(String));
  });

  it("sends the bearer token and tenant/id path on rotate", async () => {
    const { http, HttpResponse } = await import("msw");
    let seenAuth: string | null = null;
    let seenPath = "";
    mockServer.use(
      http.post(
        "*/api/v1/tenants/:org/extensions/:id/identity/rotate",
        ({ request }) => {
          seenAuth = request.headers.get("authorization");
          seenPath = new URL(request.url).pathname;
          return HttpResponse.json({
            credentials: { clientId: "c", secret: "s" },
          });
        },
      ),
    );
    await rotateExtensionIdentity("tok", "acme", "ext 1");
    expect(seenAuth).toBe("Bearer tok");
    expect(seenPath).toBe(
      "/api/v1/tenants/acme/extensions/ext%201/identity/rotate",
    );
  });
});
