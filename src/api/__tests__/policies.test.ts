import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  assignPolicyPack,
  createPolicyPack,
  decideExemption,
  evaluatePolicies,
  listExemptions,
  listPolicies,
  listPolicyPacks,
  requestExemption,
  unassignPolicyPack,
} from "@/api/policies";
import { getGitConfig, putGitConfig } from "@/api/tenants";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

describe("policies api", () => {
  it("lists org packs plus platform-global packs", async () => {
    const packs = await listPolicyPacks("tok", "acme");
    expect(packs.map((p) => p.name)).toEqual([
      "baseline-security",
      "platform-guardrails",
    ]);
  });

  it("creates a pack scoped to the org", async () => {
    const pack = await createPolicyPack("tok", "acme", {
      name: "custom-rules",
      engine: "kyverno",
      version: "0.1.0",
      manifests: [],
    });
    expect(pack.orgId).toBe("acme");
    const packs = await listPolicyPacks("tok", "acme");
    expect(packs.some((p) => p.name === "custom-rules")).toBe(true);
  });

  it("assigns and unassigns a pack", async () => {
    const assignment = await assignPolicyPack("tok", "acme", "pp-baseline", {
      targetType: "clusterset",
      targetId: "cs-prod",
    });
    expect(assignment.packId).toBe("pp-baseline");
    expect(assignment.state).toBe("active");
    await expect(
      unassignPolicyPack("tok", "acme", "pp-baseline", assignment.id),
    ).resolves.toBeUndefined();
    await expect(
      unassignPolicyPack("tok", "acme", "pp-baseline", assignment.id),
    ).rejects.toThrow(/not found/i);
  });

  it("lists, requests, and decides exemptions", async () => {
    const before = await listExemptions("tok", "acme");
    expect(before).toHaveLength(2);

    const requested = await requestExemption("tok", "acme", {
      policyId: "pol-max-size",
      reason: "bulk import",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      scope: {},
    });
    expect(requested.state).toBe("pending");

    const decided = await decideExemption("tok", "acme", "ex-1", { approve: true });
    expect(decided.state).toBe("approved");
  });

  it("lists policies and runs a dry-run evaluation", async () => {
    const policies = await listPolicies("tok", "acme");
    expect(policies).toHaveLength(2);

    const decision = await evaluatePolicies("tok", "acme", {
      itemId: "item-1",
      version: "1.0.0",
      clusterId: "cl-kind-dev",
      spec: {},
    });
    expect(decision.allow).toBe(true);
  });

  it("rejects the all-tenants scope", async () => {
    await expect(listPolicyPacks("tok", "all")).rejects.toThrow(/tenant/i);
  });
});

describe("tenant git-config api", () => {
  it("reads the seeded git config", async () => {
    const config = await getGitConfig("tok", "acme");
    expect(config.repo).toBe("acme/acme-inari-state");
    expect(config.commitPolicy).toBe("pull_request");
  });

  it("writes the git config (204) and reflects it on read", async () => {
    await putGitConfig("tok", "acme", {
      repo: "acme/state-v2",
      baseBranch: "main",
      commitPolicy: "direct",
    });
    const config = await getGitConfig("tok", "acme");
    expect(config.repo).toBe("acme/state-v2");
    expect(config.commitPolicy).toBe("direct");
  });

  it("404s for a tenant without config", async () => {
    await expect(getGitConfig("tok", "globex")).rejects.toThrow(/not found/i);
  });
});
