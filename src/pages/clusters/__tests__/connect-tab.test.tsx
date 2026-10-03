import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectTab } from "@/pages/clusters/connect-tab";
import { connectedCluster } from "@/mocks/fixtures";
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

function renderTab() {
  return render(<ConnectTab cluster={connectedCluster} />);
}

describe("ConnectTab", () => {
  it("shows tunnel status, proxy URL, and defaults to gateway mode", async () => {
    renderTab();
    expect(await screen.findByText("https://kubeproxy.inari.test")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /gateway/i })).toBeChecked();
  });

  it("shows copyable login and connect commands", async () => {
    renderTab();
    expect(await screen.findByText("inari login")).toBeInTheDocument();
    expect(screen.getByText("inari cluster connect cl-kind-dev")).toBeInTheDocument();
  });

  it("shows prereq install instructions for inari-cli and kubelogin", async () => {
    renderTab();
    await screen.findByText("inari login");
    expect(screen.getAllByText(/kubelogin/).length).toBeGreaterThan(0);
    expect(screen.getByText(/kubectl krew install oidc-login/)).toBeInTheDocument();
  });

  it("warns and defaults to direct mode when the tunnel is unavailable", async () => {
    mockControl.setAccessInfo("cl-kind-dev", {
      tunnelAvailable: false,
      tunnelUnavailableReason: "tunnel agent not installed",
    });
    renderTab();
    expect(await screen.findByText(/tunnel agent not installed/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /direct/i })).toBeChecked();
    expect(screen.getByLabelText(/^API server URL$/)).toBeInTheDocument();
  });

  it("appends --server to the connect command in direct mode", async () => {
    const user = userEvent.setup();
    mockControl.setAccessInfo("cl-kind-dev", { tunnelAvailable: false });
    renderTab();
    const input = await screen.findByLabelText(/^API server URL$/);
    await user.type(input, "https://api.example.com");
    expect(
      screen.getByText("inari cluster connect cl-kind-dev --server https://api.example.com"),
    ).toBeInTheDocument();
  });

  it("warns and disables download when kubectl access is disabled", async () => {
    mockControl.setAccessInfo("cl-kind-dev", { kubectlAccessEnabled: false });
    renderTab();
    expect((await screen.findAllByText(/kubectl access is disabled/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /download kubeconfig/i })).toBeDisabled();
  });

  it("downloads the kubeconfig for the selected mode", async () => {
    const user = userEvent.setup();
    let seenUrl: string | null = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters/cl-kind-dev/kubeconfig", ({ request }) => {
        seenUrl = request.url;
        return new HttpResponse("apiVersion: v1\n", {
          headers: { "Content-Type": "application/yaml" },
        });
      }),
    );
    const origCreate = document.createElement.bind(document);
    const anchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockImplementation((
      (tag: string, options?: ElementCreationOptions) =>
        tag === "a" ? anchor : origCreate(tag, options)) as typeof document.createElement);
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock");
    URL.revokeObjectURL = vi.fn();

    renderTab();
    const button = await screen.findByRole("button", { name: /download kubeconfig/i });
    await user.click(button);
    await vi.waitFor(() => expect(anchor.click).toHaveBeenCalled());
    expect(new URL(seenUrl!).searchParams.get("mode")).toBe("gateway");
  });
});
