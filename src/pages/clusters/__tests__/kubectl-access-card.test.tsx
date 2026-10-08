import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setClusterFeatureFlag, setPlatformFeatureFlag } from "@/api/feature-flags";
import { KubectlAccessCard } from "@/pages/clusters/kubectl-access-card";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
beforeEach(() => mockControl.reset());
afterAll(() => mockServer.close());

describe("KubectlAccessCard", () => {
  it("shows the inherited platform state with no cluster override badge", async () => {
    render(<KubectlAccessCard clusterId="cl-kind-dev" />);
    await screen.findByText("Enabled");
    expect(screen.queryByText("cluster override")).not.toBeInTheDocument();
  });

  it("disables kubectl for this cluster only and re-enables via the platform default", async () => {
    const user = userEvent.setup();
    render(<KubectlAccessCard clusterId="cl-kind-dev" />);
    await screen.findByText("Enabled");

    await user.click(screen.getByRole("button", { name: "Disable for this cluster" }));
    await screen.findByText("Disabled");
    expect(screen.getByText("cluster override")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use platform default" }));
    await screen.findByText("Enabled");
    expect(screen.queryByText("cluster override")).not.toBeInTheDocument();
  });

  it("reflects a platform-wide disable and can override it back on", async () => {
    await setPlatformFeatureFlag("test-token", "kubectl_access.enabled", false);
    const user = userEvent.setup();
    render(<KubectlAccessCard clusterId="cl-kind-dev" />);
    await screen.findByText("Disabled");
    expect(screen.queryByText("cluster override")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enable for this cluster" }));
    await screen.findByText("Enabled");
    expect(screen.getByText("cluster override")).toBeInTheDocument();
  });

  it("surfaces the env-pinned notice", async () => {
    mockControl.setFlagEnvPinned(true);
    render(<KubectlAccessCard clusterId="cl-kind-dev" />);
    await screen.findByText("Enabled");
    expect(
      screen.getByText(/Pinned by an explicitly set environment variable/),
    ).toBeInTheDocument();
  });

  it("surfaces pre-existing overrides from the API", async () => {
    await setClusterFeatureFlag("test-token", "cl-kind-dev", "kubectl_access.enabled", false);
    render(<KubectlAccessCard clusterId="cl-kind-dev" />);
    await screen.findByText("Disabled");
    expect(screen.getByText("cluster override")).toBeInTheDocument();
  });

  it("shows an error card when the flags API fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters/cl-kind-dev/feature-flags", () =>
        HttpResponse.json({ title: "Error", status: 500, detail: "db down" }, { status: 500 }),
      ),
    );
    render(<KubectlAccessCard clusterId="cl-kind-dev" />);
    expect(await screen.findByText(/Failed to load kubectl access state/)).toBeInTheDocument();
  });

  it("surfaces a write denial (viewer toggling) as an inline error", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.put("*/api/v1/tenants/acme/clusters/cl-kind-dev/feature-flags/:key", () =>
        HttpResponse.json(
          { title: "Error", status: 403, detail: "insufficient permissions" },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<KubectlAccessCard clusterId="cl-kind-dev" />);
    await screen.findByText("Enabled");
    await user.click(screen.getByRole("button", { name: "Disable for this cluster" }));
    expect(await screen.findByText(/insufficient permissions/)).toBeInTheDocument();
    // State unchanged: still enabled, no override badge.
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.queryByText("cluster override")).not.toBeInTheDocument();
  });
});
