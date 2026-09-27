import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GitConnectionsPage } from "@/pages/settings/org/git-connections";
import { policyMockControl, connectGitProviderMock } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

let mockTenant = "acme";
vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: {} }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

const originalLocation = window.location;

function stubLocationAssign() {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign, href: "http://localhost/", origin: "http://localhost" },
  });
  return assign;
}

function restoreLocation() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(entry?: string) {
  const path = entry ?? `/${mockTenant}/settings/org/git-connections`;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/:tenant/settings/org/git-connections"
          element={
            <>
              <GitConnectionsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GitConnectionsPage", () => {
  it("lists providers and the connected account", async () => {
    renderPage();
    expect(await screen.findByText("ada-dev")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("GitLab")).toBeInTheDocument();
    expect(screen.getByText("Forgejo")).toBeInTheDocument();
    expect(screen.getByText("repo")).toBeInTheDocument();
    expect(screen.getByText("read:org")).toBeInTheDocument();
    expect(screen.getAllByText("not available")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    const connectButtons = screen.getAllByRole("button", { name: "Connect" });
    expect(connectButtons).toHaveLength(2);
    expect(connectButtons.every((b) => b.hasAttribute("disabled"))).toBe(true);
  });

  it("shows an empty state when no providers are configured", async () => {
    mockTenant = "initech";
    renderPage();
    expect(
      await screen.findByText(/no git providers are configured/i),
    ).toBeInTheDocument();
  });

  it("redirects to the server-provided authorize URL on connect", async () => {
    mockTenant = "globex";
    const assign = stubLocationAssign();
    try {
      const user = userEvent.setup();
      renderPage();
      await user.click(
        await screen.findByRole("button", { name: "Connect" }),
      );
      await waitFor(() => expect(assign).toHaveBeenCalled());
      expect(assign.mock.calls[0][0]).toContain(
        "https://git-provider.example/github/authorize",
      );
    } finally {
      restoreLocation();
    }
  });

  it("shows an inline error and does not redirect when authorize fails", async () => {
    mockTenant = "globex";
    policyMockControl.getState().gitAuthorizeError = {
      status: 500,
      detail: "provider misconfigured",
    };
    const assign = stubLocationAssign();
    try {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Connect" }));
      expect(await screen.findByText("provider misconfigured")).toBeInTheDocument();
      expect(assign).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });

  it("handles the callback success state and strips the params", async () => {
    connectGitProviderMock("globex", "github");
    mockTenant = "globex";
    renderPage("/globex/settings/org/git-connections?connected=github");
    expect(await screen.findByText("GitHub connected.")).toBeInTheDocument();
    expect(await screen.findByText("github-user")).toBeInTheDocument();
    expect(screen.getByTestId("location-search")).toHaveTextContent("");
  });

  it("handles the callback error state", async () => {
    renderPage(
      "/acme/settings/org/git-connections?provider=github&error=access_denied",
    );
    expect(
      await screen.findByText(/authorization to github was denied/i),
    ).toBeInTheDocument();
    expect(screen.getByText("ada-dev")).toBeInTheDocument();
  });

  it("disconnects after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Disconnect" }),
    );
    expect(await screen.findByText("GitHub disconnected.")).toBeInTheDocument();
    expect(screen.queryByText("ada-dev")).not.toBeInTheDocument();
    expect(policyMockControl.getState().gitConnections.acme).toEqual([]);
  });

  it("keeps the connection and shows an error when disconnect fails", async () => {
    policyMockControl.getState().gitDisconnectError = {
      status: 500,
      detail: "revocation failed",
    };
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Disconnect" }),
    );
    expect(await screen.findByText("revocation failed")).toBeInTheDocument();
    expect(screen.getByText("ada-dev")).toBeInTheDocument();
  });

  it("switches tenants without leaking connections or banners", async () => {
    const view = renderPage();
    expect(await screen.findByText("ada-dev")).toBeInTheDocument();

    mockTenant = "globex";
    view.rerender(
      <MemoryRouter initialEntries={["/globex/settings/org/git-connections"]}>
        <Routes>
          <Route
            path="/:tenant/settings/org/git-connections"
            element={
              <>
                <GitConnectionsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    // The previous tenant's rows must not render while the new tenant's
    // data is still loading (synchronous check before the fetch resolves).
    expect(screen.queryByText("ada-dev")).not.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.queryByText("ada-dev")).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole("button", { name: "Connect" }),
    ).toBeInTheDocument();
  });

  it("never renders token material from server payloads", async () => {
    policyMockControl.getState().gitConnections.acme.push({
      provider: "gitlab",
      login: "g-lab",
      scopes: ["api"],
      apiBase: "https://gitlab.example/api/v4",
      createdAt: new Date().toISOString(),
      // Sentinel fields the server contract must never send; if they ever
      // appear, the UI must ignore them rather than render them.
      ...({ accessToken: "ghp_SENTINEL", refreshToken: "rt_SENTINEL" } as object),
    });
    renderPage();
    expect(await screen.findByText("g-lab")).toBeInTheDocument();
    expect(screen.getByText("https://gitlab.example/api/v4")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SENTINEL");
    expect(document.body.textContent).not.toContain("accessToken");
    expect(document.body.textContent).not.toContain("refreshToken");
  });
});
