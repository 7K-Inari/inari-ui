import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getFeatures } from "@/api/features";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

describe("features api", () => {
  it("returns the kubectl-proxy feature flag (enabled by default)", async () => {
    const features = await getFeatures("tok");
    expect(features.kubectlProxy.enabled).toBe(true);
  });

  it("reflects the global kill switch", async () => {
    mockControl.setKubectlProxyEnabled(false);
    const features = await getFeatures("tok");
    expect(features.kubectlProxy.enabled).toBe(false);
  });
});
