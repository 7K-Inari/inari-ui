import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getRbacMatrix,
  putRbacMappings,
  setRbacMapping,
} from "@/api/rbac";
import { m3MockControl, rbacMatrixFor } from "@/mocks/fixtures/m3";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function capturePut() {
  const bodies: { mappings?: { team: string; role: string }[] }[] = [];
  mockServer.use(
    http.put("*/api/v1/tenants/:org/rbac/mappings", async ({ request }) => {
      bodies.push((await request.json()) as (typeof bodies)[number]);
      return HttpResponse.json({ changes: [] });
    }),
  );
  return bodies;
}

describe("rbac api", () => {
  it("normalizes nullable matrix arrays to empty lists", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/rbac", () =>
        HttpResponse.json({
          rbac: { groups: null, roles: null, mappings: null },
        }),
      ),
    );
    await expect(getRbacMatrix("tok", "acme")).resolves.toEqual({
      groups: [],
      roles: [],
      mappings: [],
    });
  });

  it("writes the declarative set as team→role mappings", async () => {
    const bodies = capturePut();
    await putRbacMappings("tok", "acme", [
      { groupPath: "tenant-acme/data", clusterRole: "tenant-acme-viewer" },
    ]);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].mappings).toEqual([
      { team: "data", role: "tenant-acme-viewer" },
    ]);
  });

  it("setRbacMapping adds a cell by composing over the bulk PUT", async () => {
    const bodies = capturePut();
    const target = {
      groupPath: "tenant-acme/data",
      clusterRole: "tenant-acme-operator",
    };
    expect(rbacMatrixFor("acme").mappings).not.toContainEqual(target);
    await setRbacMapping("tok", "acme", target.groupPath, target.clusterRole, true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].mappings).toContainEqual({
      team: "data",
      role: "tenant-acme-operator",
    });
    // Existing mappings are preserved in the declarative set.
    for (const existing of rbacMatrixFor("acme").mappings) {
      const team = existing.groupPath.split("/").pop()!;
      expect(bodies[0].mappings).toContainEqual({
        team,
        role: existing.clusterRole,
      });
    }
  });

  it("setRbacMapping removes a cell without touching the others", async () => {
    const bodies = capturePut();
    const existing = rbacMatrixFor("acme").mappings[0];
    await setRbacMapping(
      "tok",
      "acme",
      existing.groupPath,
      existing.clusterRole,
      false,
    );
    expect(bodies).toHaveLength(1);
    const team = existing.groupPath.split("/").pop()!;
    expect(bodies[0].mappings ?? []).not.toContainEqual({
      team,
      role: existing.clusterRole,
    });
    expect(bodies[0].mappings).toHaveLength(
      rbacMatrixFor("acme").mappings.length - 1,
    );
  });
});
