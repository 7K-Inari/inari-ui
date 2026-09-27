import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PENDING_SSO_KEY, clearExtensionSessions } from "@/ext/sso-session";
import { ExtensionSsoCallbackPage } from "@/ext/sso-callback";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "tok" }),
}));

const postSession = vi.fn();
vi.mock("@/api/extension-session", () => ({
  postExtensionSession: (...args: unknown[]) => postSession(...args),
}));

function renderCallback(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/:tenant/ext-sso/callback" element={<ExtensionSsoCallbackPage />} />
        <Route path="/acme/ext/argocd" element={<div>extension page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function seedPending(overrides: Record<string, unknown> = {}) {
  sessionStorage.setItem(
    PENDING_SSO_KEY,
    JSON.stringify({
      extensionId: "ext-argocd",
      tenant: "acme",
      nonce: "n-1",
      returnTo: "/acme/ext/argocd",
      ssoLoginBaseUrl: "https://argo.example.com",
      ...overrides,
    }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  clearExtensionSessions();
  window.history.replaceState(null, "", "/");
  postSession.mockResolvedValue({ extensionId: "ext-argocd", state: "active", expiresAt: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  postSession.mockClear();
});

describe("ExtensionSsoCallbackPage", () => {
  it("completes the handoff and returns to the originating page", async () => {
    seedPending();
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=n-1#session=secret");
    renderCallback("/acme/ext-sso/callback?nonce=n-1#session=secret");
    await waitFor(() => expect(screen.getByText("extension page")).toBeInTheDocument());
    expect(postSession).toHaveBeenCalledWith("tok", "acme", "ext-argocd", {
      sessionMaterial: "secret",
      nonce: "n-1",
    });
  });

  it("shows a sign-in failure with a retry when the round-trip fails", async () => {
    seedPending();
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=n-1");
    renderCallback("/acme/ext-sso/callback?nonce=n-1");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/sign-in failed/i),
    );
    expect(screen.getByRole("button", { name: /retry sign-in/i })).toBeInTheDocument();
  });

  it("shows a failure without retry when nothing is pending", async () => {
    renderCallback("/acme/ext-sso/callback?nonce=n-1");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /retry sign-in/i })).not.toBeInTheDocument();
  });
});
