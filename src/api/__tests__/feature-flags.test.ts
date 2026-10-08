import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearClusterFeatureFlag,
  clearPlatformFeatureFlag,
  listClusterFeatureFlags,
  listPlatformFeatureFlags,
  setClusterFeatureFlag,
  setPlatformFeatureFlag,
} from "@/api/feature-flags";
import { KUBECTL_ACCESS_FLAG_KEY, mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";
import { setCurrentTenant } from "@/tenant/current";

beforeAll(() => {
  setCurrentTenant("acme");
  mockServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

describe("platform feature flags api", () => {
  it("lists the platform catalog with effective values", async () => {
    const flags = await listPlatformFeatureFlags("tok");
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      key: KUBECTL_ACCESS_FLAG_KEY,
      value: true,
      overridden: false,
      envPinned: false,
    });
  });

  it("sets and clears the platform default", async () => {
    await setPlatformFeatureFlag("tok", KUBECTL_ACCESS_FLAG_KEY, false);
    let flags = await listPlatformFeatureFlags("tok");
    expect(flags[0]).toMatchObject({ value: false, overridden: true });

    await clearPlatformFeatureFlag("tok", KUBECTL_ACCESS_FLAG_KEY);
    flags = await listPlatformFeatureFlags("tok");
    expect(flags[0]).toMatchObject({ value: true, overridden: false });
  });

  it("404s on unknown flag keys", async () => {
    await expect(setPlatformFeatureFlag("tok", "nope.flag", true)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("cluster feature flags api", () => {
  it("inherits the platform value until overridden", async () => {
    await setPlatformFeatureFlag("tok", KUBECTL_ACCESS_FLAG_KEY, false);
    const flags = await listClusterFeatureFlags("tok", "cl-kind-dev");
    expect(flags[0]).toMatchObject({ value: false, overridden: false });
  });

  it("cluster override beats the platform default; clearing reverts", async () => {
    await setClusterFeatureFlag("tok", "cl-kind-dev", KUBECTL_ACCESS_FLAG_KEY, false);
    let flags = await listClusterFeatureFlags("tok", "cl-kind-dev");
    expect(flags[0]).toMatchObject({ value: false, overridden: true });
    // Other clusters stay at the platform value.
    flags = await listClusterFeatureFlags("tok", "cl-eks-prod");
    expect(flags[0]).toMatchObject({ value: true, overridden: false });

    await clearClusterFeatureFlag("tok", "cl-kind-dev", KUBECTL_ACCESS_FLAG_KEY);
    flags = await listClusterFeatureFlags("tok", "cl-kind-dev");
    expect(flags[0]).toMatchObject({ value: true, overridden: false });
  });

  it("404s for unknown clusters", async () => {
    await expect(listClusterFeatureFlags("tok", "cl-nope")).rejects.toMatchObject({
      status: 404,
    });
  });
});
