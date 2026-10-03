import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ClusterDetailPage } from "@/pages/clusters/cluster-detail";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

// Feature flag off: the Connect tab must disappear entirely (flag task
// f368d08b is parked; runtime config can flip this without UI changes).
vi.mock("@/config", async (importActual) => {
  const actual = await importActual<typeof import("@/config")>();
  return {
    ...actual,
    config: { ...actual.config, features: { ...actual.config.features, kubectlAccess: false } },
  };
});

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
beforeEach(() => mockControl.reset());
afterAll(() => mockServer.close());

describe("ClusterDetailPage with features.kubectlAccess=false", () => {
  it("hides the Connect tab", async () => {
    render(
      <MemoryRouter initialEntries={["/acme/clusters/cl-kind-dev"]}>
        <Routes>
          <Route path="/:tenant/clusters/:clusterId" element={<ClusterDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "kind-dev" });
    expect(screen.queryByRole("tab", { name: "Connect" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Capabilities" })).toBeInTheDocument();
  });

  it("does not render connect content even with ?tab=connect", async () => {
    render(
      <MemoryRouter initialEntries={["/acme/clusters/cl-kind-dev?tab=connect"]}>
        <Routes>
          <Route path="/:tenant/clusters/:clusterId" element={<ClusterDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "kind-dev" });
    expect(screen.queryByRole("tab", { name: "Connect" })).not.toBeInTheDocument();
    // Falls back to the default tab rather than rendering hidden content.
    expect(screen.getByRole("tab", { name: "Capabilities" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
