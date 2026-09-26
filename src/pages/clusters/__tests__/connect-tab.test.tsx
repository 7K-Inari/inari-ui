import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectTab } from "@/pages/clusters/connect-tab";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

let mockOrgRoles: Record<string, string> | undefined = { acme: "platform-engineer" };
vi.mock("@/auth/permissions-context", () => ({
  usePermissions: () => ({ canCreateOrganizations: false, orgRoles: mockOrgRoles }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
beforeEach(() => {
  mockOrgRoles = { acme: "platform-engineer" };
  mockControl.reset();
  // Default: the local proxy is down (network error on the probe).
  mockServer.use(
    http.get(/\/version$/, () => HttpResponse.error()),
  );
});
afterAll(() => mockServer.close());

function renderTab(id = "cl-kind-dev") {
  return render(
    <MemoryRouter>
      <ConnectTab clusterId={id} />
    </MemoryRouter>,
  );
}

describe("ConnectTab", () => {
  it("guides through proxy setup with copyable commands", async () => {
    renderTab();
    // Step 1: kubelogin exec-credential setup from the access-info contract.
    expect(await screen.findByText(/kubelogin/)).toBeInTheDocument();
    expect(await screen.findByText(/oidc-issuer-url=http:\/\/keycloak\.local\/realms\/inari/)).toBeInTheDocument();
    expect(screen.getByText(/oidc-client-id=acme-kubectl/)).toBeInTheDocument();
    // Step 2: the exact proxy command with the default port.
    expect(screen.getByText(/kubectl proxy --port=8001/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /copy/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("indicates when the proxy is reachable", async () => {
    mockServer.use(
      http.get("http://127.0.0.1:8001/version", () =>
        HttpResponse.json({ major: "1", minor: "30", gitVersion: "v1.30.2" }),
      ),
    );
    renderTab();
    expect(await screen.findByText(/proxy reachable/i)).toBeInTheDocument();
    expect(screen.getByText(/v1\.30\.2/)).toBeInTheDocument();
  });

  it("shows a waiting state while the proxy is down", async () => {
    renderTab();
    expect(await screen.findByText(/waiting for the proxy/i)).toBeInTheDocument();
    expect(screen.queryByText(/proxy reachable/i)).not.toBeInTheDocument();
  });

  it("probes the port the user edits", async () => {
    let probed = false;
    mockServer.use(
      http.get("http://127.0.0.1:9001/version", () => {
        probed = true;
        return HttpResponse.json({ major: "1", minor: "30", gitVersion: "v1.30.2" });
      }),
    );
    const user = userEvent.setup();
    renderTab();
    const portInput = await screen.findByLabelText(/proxy port/i);
    await user.clear(portInput);
    await user.type(portInput, "9001");
    await waitFor(() => expect(probed).toBe(true));
    expect(await screen.findByText(/proxy reachable/i)).toBeInTheDocument();
  });

  it("does not probe while the port input is empty", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
    renderTab();
    const portInput = await screen.findByLabelText(/proxy port/i);
    // Wait for the initial 8001 probe to settle, then stop counting it.
    await screen.findByText(/waiting for the proxy/i);
    fetchSpy.mockClear();
    await user.clear(portInput);
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/waiting for the proxy/i)).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it("shows a notice and hides the setup when the global kill switch is on", async () => {
    mockControl.setKubectlProxyEnabled(false);
    renderTab();
    expect(await screen.findByText(/disabled globally/i)).toBeInTheDocument();
    expect(screen.queryByText(/kubectl proxy --port/)).not.toBeInTheDocument();
  });

  it("lets an editor disable and re-enable the proxy for the cluster", async () => {
    const user = userEvent.setup();
    renderTab();
    expect(await screen.findByText(/kubectl proxy --port=8001/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /disable for this cluster/i }));
    expect(await screen.findByText(/disabled for this cluster/i)).toBeInTheDocument();
    expect(screen.queryByText(/kubectl proxy --port/)).not.toBeInTheDocument();
    expect(mockControl.getState().clusters.find((c) => c.id === "cl-kind-dev")?.kubectlProxyDisabled).toBe(true);

    await user.click(screen.getByRole("button", { name: /enable kubectl proxy/i }));
    expect(await screen.findByText(/kubectl proxy --port=8001/)).toBeInTheDocument();
    expect(mockControl.getState().clusters.find((c) => c.id === "cl-kind-dev")?.kubectlProxyDisabled).toBe(false);
  });

  it("shows the disabled notice without actions to read-only users", async () => {
    mockOrgRoles = { acme: "viewer" };
    mockControl.setClusterKubectlProxyDisabled("cl-kind-dev", true);
    renderTab();
    expect(await screen.findByText(/disabled for this cluster/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enable kubectl proxy/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/kubectl proxy --port/)).not.toBeInTheDocument();
  });
});
