import { describe, expect, it } from "vitest";

import { ALL_TENANTS, isValidTenant, tenantLink } from "@/tenant/tenant-link";

describe("tenantLink", () => {
  it("builds tenant-prefixed deep links", () => {
    expect(tenantLink("acme", "catalog")).toBe("/acme/catalog");
    expect(tenantLink("acme", "settings/identity")).toBe(
      "/acme/settings/identity",
    );
  });

  it("strips leading slashes from the path", () => {
    expect(tenantLink("acme", "//catalog")).toBe("/acme/catalog");
  });

  it("supports the all-tenants scope", () => {
    expect(tenantLink(ALL_TENANTS, "overview")).toBe("/all/overview");
  });
});

describe("isValidTenant", () => {
  it("accepts the all-tenants scope and known orgs", () => {
    expect(isValidTenant(ALL_TENANTS, [])).toBe(true);
    expect(isValidTenant("acme", ["acme", "globex"])).toBe(true);
  });

  it("rejects unknown orgs", () => {
    expect(isValidTenant("evilcorp", ["acme"])).toBe(false);
    expect(isValidTenant("acme", [])).toBe(false);
  });
});
