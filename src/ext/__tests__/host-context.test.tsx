import { render, screen, waitFor } from "@testing-library/react";
import { ApiClient, getAuthState, SessionExpiredError } from "@7k-inari/ui-plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExtensionHostProviders, useExtensionSession } from "@/ext/host-context";
import type { ExtensionAuthError } from "@/ext/sso-session";

const state = { present: false, tenant: "acme" };
const begin = vi.fn((...args: unknown[]) => {
  void args;
  state.present = true;
});

vi.mock("@/ext/sso-session", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/ext/sso-session")>();
  return {
    ...mod,
    beginExtensionSsoRedirect: (options: unknown) => begin(options),
    clearExtensionSession: () => {
      state.present = false;
    },
    hasExtensionSession: () => state.present,
  };
});

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "t", parsedToken: undefined }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: state.tenant, orgs: [], setTenant: vi.fn(), setTeam: vi.fn() }),
}));

const SSO = { ssoLoginBaseUrl: "https://argo.example.com" };

function Probe({ action }: { action: () => Promise<string> }) {
  const session = useExtensionSession();
  return (
    <button
      type="button"
      data-testid="run"
      onClick={(e) => {
        const el = e.currentTarget;
        session
          .runWithSession("ext-argocd", SSO, action)
          .then((r) => {
            el.textContent = `ok:${r}`;
          })
          .catch((err: ExtensionAuthError) => {
            el.textContent = `err:${err.kind}`;
          });
      }}
    >
      idle
    </button>
  );
}

beforeEach(() => {
  state.present = false;
  state.tenant = "acme";
  begin.mockClear();
});

describe("runWithSession (SDK integration seam)", () => {
  it("bootstraps before the action on first use", async () => {
    const action = vi.fn().mockResolvedValue("done");
    render(
      <ExtensionHostProviders>
        <Probe action={action} />
      </ExtensionHostProviders>,
    );
    screen.getByTestId("run").click();
    await waitFor(() => expect(screen.getByTestId("run")).toHaveTextContent("ok:done"));
    expect(begin).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.invocationCallOrder[0]).toBeGreaterThan(begin.mock.invocationCallOrder[0]);
  });

  it("force-re-bootstraps and retries once on an SDK SessionExpiredError", async () => {
    state.present = true;
    const action = vi
      .fn()
      .mockRejectedValueOnce(new SessionExpiredError(401, "expired"))
      .mockResolvedValueOnce("retried");
    render(
      <ExtensionHostProviders>
        <Probe action={action} />
      </ExtensionHostProviders>,
    );
    screen.getByTestId("run").click();
    await waitFor(() => expect(screen.getByTestId("run")).toHaveTextContent("ok:retried"));
    // Cache was dropped (force) and the round-trip re-ran before the retry.
    expect(begin).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("surfaces a classified session failure when still expired after one retry", async () => {
    state.present = true;
    const action = vi.fn().mockRejectedValue(new SessionExpiredError(401, "still expired"));
    render(
      <ExtensionHostProviders>
        <Probe action={action} />
      </ExtensionHostProviders>,
    );
    screen.getByTestId("run").click();
    await waitFor(() => expect(screen.getByTestId("run")).toHaveTextContent("err:session"));
    expect(begin).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("invokes through the host token provider and retries a flat proxy re-auth once", async () => {
    state.present = true;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ detail: "re-authentication required", code: "reauth_required" }),
        { status: 401, headers: { "content-type": "text/plain; charset=utf-8", "X-Inari-Reauth": "argocd" } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ result: "retried" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));
    const action = vi.fn(async () => {
      const auth = getAuthState();
      if (!auth) throw new Error("host auth provider is not mounted");
      const client = new ApiClient({ baseUrl: "", getToken: auth.getToken, fetchImpl });
      const result = await client.invokeExtension<{ result: string }>("ext-argocd", "/actions/sync", {
        method: "POST",
        body: { application: "demo" },
      });
      return result.result;
    });
    render(
      <ExtensionHostProviders>
        <Probe action={action} />
      </ExtensionHostProviders>,
    );
    screen.getByTestId("run").click();
    await waitFor(() => expect(screen.getByTestId("run")).toHaveTextContent("ok:retried"));
    expect(begin).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const call of fetchImpl.mock.calls) {
      const [url, init] = call as unknown as [string, RequestInit];
      expect(url).toBe("/api/extensions/ext-argocd/actions/sync");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer t");
      expect(init.body).toBe(JSON.stringify({ application: "demo" }));
    }
  });

  it("rejects without redirecting in the all-tenants context", async () => {
    state.tenant = "all";
    const action = vi.fn().mockRejectedValue(new SessionExpiredError(401, "expired"));
    render(
      <ExtensionHostProviders>
        <Probe action={action} />
      </ExtensionHostProviders>,
    );
    screen.getByTestId("run").click();
    await waitFor(() => expect(screen.getByTestId("run")).toHaveTextContent("err:unknown"));
    expect(begin).not.toHaveBeenCalled();
  });
});
