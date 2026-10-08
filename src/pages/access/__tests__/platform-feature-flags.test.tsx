import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformFeatureFlagsPage } from "@/pages/access/platform-feature-flags";
import { KUBECTL_ACCESS_FLAG_KEY, mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
beforeEach(() => mockControl.reset());
afterAll(() => mockServer.close());

describe("PlatformFeatureFlagsPage", () => {
  it("lists the flag catalog with effective values", async () => {
    render(<PlatformFeatureFlagsPage />);
    await screen.findByText(KUBECTL_ACCESS_FLAG_KEY);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.queryByText("override")).not.toBeInTheDocument();
  });

  it("disables the flag platform-wide and resets it to the default", async () => {
    const user = userEvent.setup();
    render(<PlatformFeatureFlagsPage />);
    await screen.findByText(KUBECTL_ACCESS_FLAG_KEY);

    await user.click(screen.getByRole("button", { name: "Disable platform-wide" }));
    await screen.findByText("Disabled");
    expect(screen.getByText("override")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Reset to default/ }));
    await screen.findByText("Enabled");
    expect(screen.queryByText("override")).not.toBeInTheDocument();
  });

  it("surfaces the env-pinned notice when an env override is set", async () => {
    mockControl.setFlagEnvPinned(true);
    render(<PlatformFeatureFlagsPage />);
    await screen.findByText(KUBECTL_ACCESS_FLAG_KEY);
    expect(screen.getByText(/Pinned by an explicitly set environment variable/)).toBeInTheDocument();
  });

  it("shows an error card when the API denies the listing (non platform-admin)", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/platform/feature-flags", () =>
        HttpResponse.json(
          { title: "Error", status: 403, detail: "platform feature flags require the platform org_creator permission" },
          { status: 403 },
        ),
      ),
    );
    render(<PlatformFeatureFlagsPage />);
    expect(await screen.findByText(/Failed to load feature flags/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /platform-wide/ })).not.toBeInTheDocument();
  });
});
