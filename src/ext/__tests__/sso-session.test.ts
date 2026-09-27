import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DownstreamDeniedError,
  ExtensionFailureError,
  ExchangeFailedError,
  FgaDeniedError,
  SessionExpiredError,
} from "@7k-inari/ui-plugin-sdk";

import { ApiError } from "@/api/client";
import type { ExtensionSessionViewModel } from "@/api/extension-session";
import {
  ExtensionAuthError,
  PENDING_SSO_KEY,
  beginExtensionSsoRedirect,
  buildExtensionSsoLoginUrl,
  classifyExtensionError,
  clearExtensionSession,
  clearExtensionSessions,
  completeExtensionSsoCallback,
  hasExtensionSession,
  withExtensionSessionRetry,
} from "@/ext/sso-session";

const SESSION: ExtensionSessionViewModel = {
  extensionId: "ext-argocd",
  state: "active",
  expiresAt: null,
};

function seedPending(value: unknown) {
  sessionStorage.setItem(PENDING_SSO_KEY, JSON.stringify(value));
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  clearExtensionSessions();
  window.history.replaceState(null, "", "/acme/overview");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("classifyExtensionError", () => {
  it("classifies 401 as session", () => {
    expect(classifyExtensionError(new ApiError(401, "nope"))).toBe("session");
  });

  it("classifies typed session codes as session", () => {
    expect(
      classifyExtensionError(new ApiError(403, "nope", undefined, "extension_session_expired")),
    ).toBe("session");
    expect(
      classifyExtensionError(new ApiError(400, "nope", undefined, "extension_session_required")),
    ).toBe("session");
  });

  it("classifies typed downstream denial separately from policy denial", () => {
    expect(
      classifyExtensionError(
        new ApiError(403, "denied", undefined, "extension_downstream_denied"),
      ),
    ).toBe("downstream-denied");
    expect(classifyExtensionError(new ApiError(403, "denied", "request exception"))).toBe(
      "policy",
    );
  });

  it("classifies anything else as unknown", () => {
    expect(classifyExtensionError(new ApiError(500, "boom"))).toBe("unknown");
    expect(classifyExtensionError(new Error("boom"))).toBe("unknown");
  });

  it("maps SDK invokeExtension error kinds onto the shell taxonomy", () => {
    expect(classifyExtensionError(new SessionExpiredError(401, "expired"))).toBe("session");
    expect(classifyExtensionError(new ExchangeFailedError(500, "exchange failed"))).toBe(
      "session",
    );
    expect(classifyExtensionError(new DownstreamDeniedError(403, "rbac: denied"))).toBe(
      "downstream-denied",
    );
    expect(classifyExtensionError(new FgaDeniedError(403, "fga denied"))).toBe("policy");
    expect(classifyExtensionError(new ExtensionFailureError(500, "boom"))).toBe("unknown");
  });
});

describe("withExtensionSessionRetry", () => {
  it("returns the action result without reauth on success", async () => {
    const reauth = vi.fn();
    const result = await withExtensionSessionRetry(() => Promise.resolve("ok"), { reauth });
    expect(result).toBe("ok");
    expect(reauth).not.toHaveBeenCalled();
  });

  it("re-authenticates and retries exactly once on a session error", async () => {
    const reauth = vi.fn().mockResolvedValue(undefined);
    const action = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(401, "expired"))
      .mockResolvedValueOnce("retried");
    const result = await withExtensionSessionRetry(action, { reauth });
    expect(result).toBe("retried");
    expect(reauth).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("surfaces a classified failure when still denied after one retry", async () => {
    const reauth = vi.fn().mockResolvedValue(undefined);
    const action = vi
      .fn()
      .mockRejectedValue(new ApiError(401, "still expired", undefined, "extension_session_expired"));
    await expect(withExtensionSessionRetry(action, { reauth })).rejects.toMatchObject({
      name: "ExtensionAuthError",
      kind: "session",
    });
    expect(action).toHaveBeenCalledTimes(2);
    expect(reauth).toHaveBeenCalledTimes(1);
  });

  it("does not retry downstream permission denials", async () => {
    const reauth = vi.fn();
    const action = vi
      .fn()
      .mockRejectedValue(new ApiError(403, "rbac: denied", undefined, "extension_downstream_denied"));
    await expect(withExtensionSessionRetry(action, { reauth })).rejects.toMatchObject({
      kind: "downstream-denied",
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(reauth).not.toHaveBeenCalled();
  });

  it("wraps non-ApiError failures as unknown", async () => {
    await expect(
      withExtensionSessionRetry(() => Promise.reject(new Error("boom")), { reauth: vi.fn() }),
    ).rejects.toMatchObject({ name: "ExtensionAuthError", kind: "unknown" });
  });

  it("surfaces a classified failure when reauth itself rejects", async () => {
    const action = vi.fn().mockRejectedValue(new ApiError(401, "expired"));
    const reauth = vi
      .fn()
      .mockRejectedValue(new Error("extension sessions require a specific tenant context"));
    await expect(withExtensionSessionRetry(action, { reauth })).rejects.toMatchObject({
      name: "ExtensionAuthError",
      kind: "unknown",
      message: "extension sessions require a specific tenant context",
    });
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("buildExtensionSsoLoginUrl", () => {
  it("points at the downstream login endpoint with a return_url", () => {
    const url = new URL(
      buildExtensionSsoLoginUrl("https://argo.example.com", "https://console.example.com/acme/ext-sso/callback?nonce=n-1"),
    );
    expect(url.origin + url.pathname).toBe("https://argo.example.com/auth/login");
    expect(url.searchParams.get("return_url")).toBe(
      "https://console.example.com/acme/ext-sso/callback?nonce=n-1",
    );
  });
});

describe("beginExtensionSsoRedirect", () => {
  it("stores a pending marker (no material) and navigates to the SSO login URL", () => {
    const navigate = vi.fn();
    beginExtensionSsoRedirect(
      {
        tenant: "acme",
        extensionId: "ext-argocd",
        ssoLoginBaseUrl: "https://argo.example.com",
        returnTo: "/acme/ext/argocd",
      },
      { navigate },
    );
    const raw = sessionStorage.getItem(PENDING_SSO_KEY);
    expect(raw).toBeTruthy();
    const pending = JSON.parse(raw!);
    expect(pending.extensionId).toBe("ext-argocd");
    expect(pending.tenant).toBe("acme");
    expect(pending.returnTo).toBe("/acme/ext/argocd");
    expect(typeof pending.nonce).toBe("string");
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.origin + target.pathname).toBe("https://argo.example.com/auth/login");
    const returnUrl = new URL(target.searchParams.get("return_url")!);
    expect(returnUrl.pathname).toBe("/acme/ext-sso/callback");
    expect(returnUrl.searchParams.get("nonce")).toBe(pending.nonce);
  });
});

describe("completeExtensionSsoCallback", () => {
  function pending(overrides: Record<string, unknown> = {}) {
    return {
      extensionId: "ext-argocd",
      tenant: "acme",
      nonce: "n-1",
      returnTo: "/acme/ext/argocd",
      ...overrides,
    };
  }

  it("hands material to the server, scrubs the URL, and clears pending state", async () => {
    seedPending(pending());
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=n-1#session=secret-material");
    const postSession = vi.fn().mockResolvedValue(SESSION);
    const returnTo = await completeExtensionSsoCallback("tok", { postSession });
    expect(returnTo).toBe("/acme/ext/argocd");
    expect(postSession).toHaveBeenCalledWith("tok", "acme", "ext-argocd", {
      sessionMaterial: "secret-material",
      nonce: "n-1",
    });
    // Material scrubbed from the URL and never persisted.
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");
    expect(sessionStorage.getItem(PENDING_SSO_KEY)).toBeNull();
    for (const storage of [sessionStorage, localStorage]) {
      for (let i = 0; i < storage.length; i++) {
        expect(storage.getItem(storage.key(i)!)).not.toContain("secret-material");
      }
    }
    expect(hasExtensionSession("acme", "ext-argocd")).toBe(true);
  });

  it("never logs the session material", async () => {
    seedPending(pending());
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=n-1#session=secret-material");
    const spies = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
      vi.spyOn(console, "debug"),
    ];
    await completeExtensionSsoCallback("tok", { postSession: vi.fn().mockResolvedValue(SESSION) });
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("secret-material");
      }
    }
  });

  it("rejects on nonce mismatch without posting material", async () => {
    seedPending(pending({ nonce: "n-1" }));
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=attacker#session=evil");
    const postSession = vi.fn();
    await expect(
      completeExtensionSsoCallback("tok", { postSession }),
    ).rejects.toBeInstanceOf(ExtensionAuthError);
    expect(postSession).not.toHaveBeenCalled();
    expect(hasExtensionSession("acme", "ext-argocd")).toBe(false);
  });

  it("rejects when no bootstrap is pending", async () => {
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=n-1#session=x");
    await expect(
      completeExtensionSsoCallback("tok", { postSession: vi.fn() }),
    ).rejects.toMatchObject({ kind: "session" });
  });

  it("clears the cached session on tenant switch", async () => {
    seedPending(pending());
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=n-1#session=m");
    await completeExtensionSsoCallback("tok", { postSession: vi.fn().mockResolvedValue(SESSION) });
    expect(hasExtensionSession("acme", "ext-argocd")).toBe(true);
    clearExtensionSessions("acme");
    expect(hasExtensionSession("acme", "ext-argocd")).toBe(false);
  });

  it("drops a single stale session so a forced re-bootstrap re-runs the round-trip", async () => {
    seedPending(pending());
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=n-1#session=m");
    await completeExtensionSsoCallback("tok", { postSession: vi.fn().mockResolvedValue(SESSION) });
    seedPending(pending({ extensionId: "ext-other", nonce: "n-2" }));
    window.history.replaceState(null, "", "/acme/ext-sso/callback?nonce=n-2#session=m2");
    await completeExtensionSsoCallback("tok", { postSession: vi.fn().mockResolvedValue(SESSION) });
    expect(hasExtensionSession("acme", "ext-argocd")).toBe(true);
    expect(hasExtensionSession("acme", "ext-other")).toBe(true);
    clearExtensionSession("acme", "ext-argocd");
    expect(hasExtensionSession("acme", "ext-argocd")).toBe(false);
    expect(hasExtensionSession("acme", "ext-other")).toBe(true);
  });
});
