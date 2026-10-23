import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getGitRepo,
  listGitRepos,
  registerGitRepo,
  unregisterGitRepo,
  updateGitRepo,
} from "@/api/git-repos";
import { gitReposMockControl } from "@/mocks/fixtures/git-repos";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
  gitReposMockControl.reset();
});
afterAll(() => mockServer.close());

describe("git repos api", () => {
  it("lists repos for the tenant", async () => {
    const repos = await listGitRepos("tok", "acme");
    expect(repos.length).toBeGreaterThan(0);
    const baseline = repos.find((r) => r.isDefault);
    expect(baseline).toBeDefined();
    expect(baseline?.scope).toBe("platform");
  });

  it("returns an empty list when the tenant has no repos", async () => {
    const repos = await listGitRepos("tok", "globex");
    expect(repos).toEqual([]);
  });

  it("registers a new repo", async () => {
    const created = await registerGitRepo("tok", "acme", {
      name: "team-gamma-gitops",
      repo: "acme/team-gamma-gitops",
      scope: "team",
      teamId: "team-platform",
      commitPolicy: "pull_request",
      baseBranch: "main",
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("team-gamma-gitops");
    expect(created.scope).toBe("team");
    const repos = await listGitRepos("tok", "acme");
    expect(repos.some((r) => r.id === created.id)).toBe(true);
  });

  it("gets a single repo with provider status", async () => {
    const repos = await listGitRepos("tok", "acme");
    const first = repos[0];
    const detail = await getGitRepo("tok", "acme", first.id);
    expect(detail.id).toBe(first.id);
    expect(detail.status).toBeDefined();
    expect(detail.status?.state).toBe("ok");
  });

  it("updates a repo's commit policy", async () => {
    const repos = await listGitRepos("tok", "acme");
    const teamRepo = repos.find((r) => r.scope === "team");
    expect(teamRepo).toBeDefined();
    const updated = await updateGitRepo("tok", "acme", teamRepo!.id, {
      commitPolicy: "pull_request",
    });
    expect(updated.commitPolicy).toBe("pull_request");
  });

  it("promotes a repo to default and demotes the previous default", async () => {
    const repos = await listGitRepos("tok", "acme");
    const teamRepo = repos.find((r) => r.scope === "team");
    await updateGitRepo("tok", "acme", teamRepo!.id, { isDefault: true });
    const after = await listGitRepos("tok", "acme");
    const newDefault = after.find((r) => r.id === teamRepo!.id);
    const oldDefault = after.find((r) => r.id !== teamRepo!.id && r.scope === "platform");
    expect(newDefault?.isDefault).toBe(true);
    expect(oldDefault?.isDefault).toBe(false);
  });

  it("rejects isDefault=false on PATCH", async () => {
    const repos = await listGitRepos("tok", "acme");
    const def = repos.find((r) => r.isDefault);
    await expect(
      updateGitRepo("tok", "acme", def!.id, { isDefault: false }),
    ).rejects.toThrow();
  });

  it("deletes a repo with no refs", async () => {
    const created = await registerGitRepo("tok", "acme", {
      name: "scratch",
      repo: "acme/scratch",
      scope: "team",
      teamId: "team-platform",
    });
    await expect(
      unregisterGitRepo("tok", "acme", created.id),
    ).resolves.toBeUndefined();
    const repos = await listGitRepos("tok", "acme");
    expect(repos.some((r) => r.id === created.id)).toBe(false);
  });

  it("blocks delete of the default repo (409)", async () => {
    const repos = await listGitRepos("tok", "acme");
    const def = repos.find((r) => r.isDefault);
    await expect(unregisterGitRepo("tok", "acme", def!.id)).rejects.toThrow(
      /default/i,
    );
  });

  it("blocks delete when refs exist (409), allows with force+mode=orphan", async () => {
    const repos = await listGitRepos("tok", "acme");
    const withRefs = repos.find((r) => r.name === "team-alpha-gitops");
    expect(withRefs).toBeDefined();
    await expect(
      unregisterGitRepo("tok", "acme", withRefs!.id),
    ).rejects.toThrow(/in use|workload/i);
    await expect(
      unregisterGitRepo("tok", "acme", withRefs!.id, {
        force: true,
        mode: "orphan",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects the all-tenants scope", async () => {
    await expect(listGitRepos("tok", "all")).rejects.toThrow(/tenant/i);
  });

  it("maps the server wire shape (snake_case tolerant pass-through)", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/git-repos", () =>
        HttpResponse.json({
          repos: [
            {
              id: "r-x",
              orgId: "acme",
              name: "x",
              repo: "acme/x",
              provider: "github",
              scope: "platform",
              commitPolicy: "direct",
              baseBranch: "main",
              isDefault: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ),
    );
    const repos = await listGitRepos("tok", "acme");
    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({
      id: "r-x",
      name: "x",
      repo: "acme/x",
      provider: "github",
      scope: "platform",
      commitPolicy: "direct",
      baseBranch: "main",
      isDefault: true,
    });
  });
});
