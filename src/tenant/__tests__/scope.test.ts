import { describe, expect, it } from "vitest";

import { assertTenantScope, scopeToTenant } from "@/tenant/scope";

const items = [
  { tenant: "acme", name: "a" },
  { tenant: "globex", name: "b" },
];

describe("scopeToTenant", () => {
  it("returns everything for the all-tenants scope", () => {
    expect(scopeToTenant(items, "all")).toHaveLength(2);
  });

  it("filters to the active org", () => {
    expect(scopeToTenant(items, "acme")).toEqual([{ tenant: "acme", name: "a" }]);
  });
});

describe("assertTenantScope", () => {
  it("allows in-scope resources", () => {
    expect(() => assertTenantScope(items[0], "acme")).not.toThrow();
    expect(() => assertTenantScope(items[0], "all")).not.toThrow();
  });

  it("blocks cross-tenant access", () => {
    expect(() => assertTenantScope(items[1], "acme")).toThrow(/cross-tenant/i);
  });
});
