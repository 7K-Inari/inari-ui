import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequireAuth } from "@/auth/require-auth";

const login = vi.fn();
let authState = {
  initialized: true,
  authenticated: false,
  login,
  logout: vi.fn(),
};

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => authState,
}));

describe("RequireAuth", () => {
  beforeEach(() => {
    login.mockClear();
    authState = {
      initialized: true,
      authenticated: false,
      login,
      logout: vi.fn(),
    };
  });

  it("redirects to login when unauthenticated", async () => {
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    expect(screen.getByText(/redirecting to sign in/i)).toBeInTheDocument();
    await waitFor(() => expect(login).toHaveBeenCalled());
  });

  it("renders children when authenticated", () => {
    authState = { ...authState, authenticated: true };
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("shows a loading state before initialization", () => {
    authState = { ...authState, initialized: false };
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
