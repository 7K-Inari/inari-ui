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
});
