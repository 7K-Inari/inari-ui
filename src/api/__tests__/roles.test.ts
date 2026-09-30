import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createRole,
  deleteRole,
  getPermissionCatalog,
  listRoles,
  updateRole,
} from "@/api/roles";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

describe("roles api", () => {
  it("lists built-in roles with permission bundles", async () => {
    const roles = await listRoles("tok", "acme");
    expect(roles).toHaveLength(4);
    const admin = roles.find((r) => r.name === "admin")!;
    expect(admin.builtin).toBe(true);
    expect(admin.permissions).toContain("tenant.admin");
  });

  it("serves the static permission catalog", async () => {
    const catalog = await getPermissionCatalog("tok", "acme");
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.find((p) => p.slug === "tenant.admin")?.domain).toBe("tenant");
  });

  it("creates a custom role", async () => {
    const role = await createRole("tok", "acme", {
      name: "deployer",
      displayName: "Deployer",
      description: "Deploys from the catalog",
      permissions: ["tenant.read", "deployments.create"],
    });
    expect(role.builtin).toBe(false);
    expect(role.permissions).toEqual(["tenant.read", "deployments.create"]);
    expect(
      policyMockControl.getState().roles.acme.map((r) => r.name),
    ).toContain("deployer");
  });

  it("edits a built-in permission bundle without renaming", async () => {
    const role = await updateRole("tok", "acme", "viewer", {
      permissions: ["tenant.read", "extensions.invoke"],
    });
    expect(role.name).toBe("viewer");
    expect(role.permissions).toContain("extensions.invoke");
  });

  it("surfaces 409 when renaming a built-in", async () => {
    await expect(
      updateRole("tok", "acme", "admin", { name: "superadmin" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("deletes a custom role but never a built-in", async () => {
    await createRole("tok", "acme", {
      name: "temp",
      permissions: ["tenant.read"],
    });
    await expect(deleteRole("tok", "acme", "temp")).resolves.toBeUndefined();
    expect(
      policyMockControl.getState().roles.acme.map((r) => r.name),
    ).not.toContain("temp");
    await expect(deleteRole("tok", "acme", "admin")).rejects.toMatchObject({
      status: 409,
    });
  });

  it("rejects deleting a custom role bound to a team", async () => {
    const bound = policyMockControl
      .getState()
      .teams.acme.find((t) => t.name === "platform-team")!;
    await createRole("tok", "acme", { name: "bound-role", permissions: [] });
    bound.roleId = (
      policyMockControl.getState().roles.acme.find((r) => r.name === "bound-role")!
    ).id;
    await expect(deleteRole("tok", "acme", "bound-role")).rejects.toMatchObject(
      { status: 409 },
    );
  });

  it("normalizes a null roles array to empty", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/roles", () =>
        HttpResponse.json({ roles: null }),
      ),
    );
    await expect(listRoles("tok", "acme")).resolves.toEqual([]);
  });
});
