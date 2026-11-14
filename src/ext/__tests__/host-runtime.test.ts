import { beforeEach, describe, expect, it, vi } from "vitest";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@module-federation/runtime", () => ({ init }));

import { getHostRuntime, resetHostRuntime } from "@/ext/host-runtime";

describe("extension host runtime", () => {
  beforeEach(() => {
    resetHostRuntime();
    init.mockClear();
  });

  it("provides every canonical singleton with no version fallback", () => {
    getHostRuntime();
    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0];
    expect(Object.keys(options.shared).sort()).toEqual([
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "zod",
      "@7k-inari/ui-plugin-sdk",
    ].sort());
    for (const shared of Object.values(options.shared) as Array<{ shareConfig: { singleton: boolean; requiredVersion: boolean } }>) {
      expect(shared.shareConfig).toEqual({ singleton: true, requiredVersion: false });
    }
  });
});
