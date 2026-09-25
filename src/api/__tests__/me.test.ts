import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchMyPermissions } from "@/api/me";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

function stubPermissions(body: unknown) {
  mockServer.use(
    http.get("*/api/v1/me/permissions", () =>
      HttpResponse.json(body as Record<string, unknown>),
    ),
  );
}

describe("me api", () => {
  it("maps the contract body onto the view model", async () => {
    stubPermissions({
      canCreateOrganizations: true,
      orgRoles: { acme: "org-admin" },
    });
    await expect(fetchMyPermissions("tok")).resolves.toEqual({
      canCreateOrganizations: true,
      orgRoles: { acme: "org-admin" },
    });
  });

  it("parses the forward-compatible tenants seam when present", async () => {
    stubPermissions({
      canCreateOrganizations: false,
      tenants: {
        acme: { canDeploy: true, canDecideApprovals: "not-a-bool" },
        broken: null,
      },
    });
    await expect(fetchMyPermissions("tok")).resolves.toEqual({
      canCreateOrganizations: false,
      tenants: { acme: { canDeploy: true } },
    });
  });

  it("omits absent projections instead of treating them as denial", async () => {
    stubPermissions({ canCreateOrganizations: false });
    const perms = await fetchMyPermissions("tok");
    expect(perms.tenants).toBeUndefined();
    expect(perms.orgRoles).toBeUndefined();
  });

  it("drops non-string org role values", async () => {
    stubPermissions({
      canCreateOrganizations: false,
      orgRoles: { acme: "viewer", bad: 42 },
    });
    await expect(fetchMyPermissions("tok")).resolves.toEqual({
      canCreateOrganizations: false,
      orgRoles: { acme: "viewer" },
    });
  });
});
