import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  updateToken: vi.fn().mockResolvedValue(true),
  init: vi.fn(),
}));

vi.mock("keycloak-js", () => ({
  default: vi.fn().mockImplementation(() => ({
    init: mocks.init,
    login: mocks.login,
    logout: mocks.logout,
    updateToken: mocks.updateToken,
  })),
}));

async function renderGuarded() {
  const { AuthProvider } = await import("@/auth/auth-context");
  const { RequireAuth } = await import("@/auth/require-auth");
  return render(
    <AuthProvider>
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    mocks.login.mockClear();
    mocks.init.mockReset();
  });

  it("renders children once authenticated", async () => {
    mocks.init.mockResolvedValue(true);
    renderGuarded();
    expect(await screen.findByText("secret")).toBeInTheDocument();
  });

  it("shows an error state instead of redirecting when Keycloak is unreachable", async () => {
    mocks.init.mockRejectedValue(new Error("keycloak unreachable"));
    renderGuarded();
    expect(await screen.findByText("Unable to sign in")).toBeInTheDocument();
    expect(screen.getByText(/keycloak unreachable/)).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("retries initialization from the error state", async () => {
    const user = userEvent.setup();
    mocks.init.mockRejectedValueOnce(new Error("keycloak unreachable"));
    renderGuarded();
    await user.click(await screen.findByRole("button", { name: /try again/i }));
    await waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(2));
  });

  it("falls back to interactive login when a silent org switch fails", async () => {
    sessionStorage.setItem("inari-pending-org", "globex");
    mocks.init.mockRejectedValue(new Error("login_required"));
    renderGuarded();
    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith({
        scope: "openid organization:globex",
      }),
    );
  });

  it("shows the error state when the interactive fallback was already attempted", async () => {
    sessionStorage.setItem("inari-pending-org", "globex");
    sessionStorage.setItem("inari-org-fallback-attempted", "1");
    mocks.init.mockRejectedValue(new Error("access_denied"));
    renderGuarded();
    expect(await screen.findByText("Unable to sign in")).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("inari-pending-org")).toBeNull();
  });
});
