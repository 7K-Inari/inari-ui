import { describe, expect, it } from "vitest";

import { canCreateOrganizations, hasRealmRole } from "@/auth/roles";

describe("hasRealmRole", () => {
  it("returns false when token is undefined", () => {
    expect(hasRealmRole(undefined, "platform-admin")).toBe(false);
  });

  it("returns false when realm_access is missing", () => {
    expect(hasRealmRole({}, "platform-admin")).toBe(false);
  });

  it("returns false when roles is not an array", () => {
    expect(
      hasRealmRole({ realm_access: { roles: "platform-admin" } }, "platform-admin"),
    ).toBe(false);
  });

  it("returns false when the role is absent", () => {
    expect(
      hasRealmRole({ realm_access: { roles: ["developer"] } }, "platform-admin"),
    ).toBe(false);
  });

  it("returns true when the role is present", () => {
    expect(
      hasRealmRole(
        { realm_access: { roles: ["developer", "platform-admin"] } },
        "platform-admin",
      ),
    ).toBe(true);
  });
});

describe("canCreateOrganizations", () => {
  it("is true only for platform admins", () => {
    expect(
      canCreateOrganizations({ realm_access: { roles: ["platform-admin"] } }),
    ).toBe(true);
    expect(canCreateOrganizations({ realm_access: { roles: [] } })).toBe(false);
    expect(canCreateOrganizations(undefined)).toBe(false);
  });
});
