import { describe, expect, it } from "vitest";

import { canInvokeExtension, filterAllowedExtensions } from "@/ext/rbac";

describe("extension RBAC", () => {
  it("allows when the specific invoke permission is present", () => {
    expect(
      canInvokeExtension(["extensions:invoke:inari-ext-argocd"], { name: "inari-ext-argocd" }),
    ).toBe(true);
  });

  it("allows with the wildcard permission", () => {
    expect(canInvokeExtension(["extensions:invoke:*"], { name: "any" })).toBe(true);
  });

  it("denies when the permission is absent", () => {
    expect(canInvokeExtension([], { name: "inari-ext-argocd" })).toBe(false);
  });

  it("honours an explicit requiredPermission", () => {
    expect(
      canInvokeExtension(["custom:perm"], { name: "x", requiredPermission: "custom:perm" }),
    ).toBe(true);
  });

  it("filterAllowedExtensions passes everything through when permissions are unavailable", () => {
    const remotes = [{ name: "a" }, { name: "b" }];
    expect(filterAllowedExtensions(null, remotes)).toHaveLength(2);
    expect(filterAllowedExtensions([], remotes)).toHaveLength(0);
  });
});
