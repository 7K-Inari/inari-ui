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
});
