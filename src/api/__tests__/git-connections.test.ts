import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  deleteGitConnection,
  getGitConnectionAuthorizeUrl,
  listGitConnections,
} from "@/api/git-connections";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

describe("git connections api", () => {
  it("lists connections and providers for the tenant", async () => {
    const { connections, providers } = await listGitConnections("tok", "acme");
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      provider: "github",
      login: "ada-dev",
      scopes: ["repo", "read:org"],
      apiBase: null,
    });
    expect(providers.map((p) => [p.id, p.enabled])).toEqual([
      ["github", true],
      ["gitlab", false],
      ["forgejo", false],
    ]);
  });

  it("normalizes missing optional fields", async () => {
    const { connections } = await listGitConnections("tok", "globex");
    expect(connections).toEqual([]);
  });

  it("returns the authorize URL and reflects the connected provider", async () => {
    const url = await getGitConnectionAuthorizeUrl("tok", "globex", "github");
    expect(url).toContain("https://git-provider.example/github/authorize");
    const { connections } = await listGitConnections("tok", "globex");
    expect(connections.map((c) => c.provider)).toEqual(["github"]);
  });

  it("propagates authorize errors as ApiError", async () => {
    await expect(
      getGitConnectionAuthorizeUrl("tok", "acme", "gitlab"),
    ).rejects.toThrow(/disabled/i);
    await expect(
      getGitConnectionAuthorizeUrl("tok", "acme", "bitbucket"),
    ).rejects.toThrow(/not configured/i);
  });

  it("deletes a connection (204) and 404s when absent", async () => {
    await expect(deleteGitConnection("tok", "acme", "github")).resolves.toBeUndefined();
    const { connections } = await listGitConnections("tok", "acme");
    expect(connections).toEqual([]);
    await expect(deleteGitConnection("tok", "acme", "github")).rejects.toThrow(
      /not found/i,
    );
  });

  it("rejects the all-tenants scope", async () => {
    await expect(listGitConnections("tok", "all")).rejects.toThrow(/tenant/i);
  });

  // Pins the live-run 7045f491 contract: the server sends providerLogin and
  // scopes as a space/comma-separated string; the adapter maps them.
  it("maps the server wire shape (providerLogin, scopes string)", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/git-connections", () =>
        HttpResponse.json({
          connections: [
            {
              provider: "github",
              providerLogin: "octo-dev",
              scopes: "repo read:user",
              createdAt: new Date().toISOString(),
            },
            {
              provider: "gitlab",
              providerLogin: "g-lab",
              scopes: "api,read_repository",
              apiBase: "https://gitlab.example/api/v4",
              createdAt: new Date().toISOString(),
            },
            {
              provider: "forgejo",
              providerLogin: "f-jo",
              scopes: "",
              createdAt: new Date().toISOString(),
            },
          ],
          providers: [],
        }),
      ),
    );
    const { connections } = await listGitConnections("tok", "acme");
    expect(connections).toEqual([
      expect.objectContaining({ login: "octo-dev", scopes: ["repo", "read:user"], apiBase: null }),
      expect.objectContaining({
        login: "g-lab",
        scopes: ["api", "read_repository"],
        apiBase: "https://gitlab.example/api/v4",
      }),
      expect.objectContaining({ login: "f-jo", scopes: [], apiBase: null }),
    ]);
  });
});
