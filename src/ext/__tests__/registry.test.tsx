import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UiExtensionRemoteViewModel } from "@/api/extensions";
import { ExtensionLoadError } from "@/ext/load-extension";
import { ExtensionsProvider, useExtensions, useSlots } from "@/ext/registry";
import { argocdExtension, argocdRemote } from "@/mocks/fixtures/extensions";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "t", parsedToken: undefined }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

function Probe() {
  const { entries, loading } = useExtensions();
  const tabs = useSlots("cluster-tab");
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="entries">{entries.map((e) => `${e.remote.name}:${e.state}`).join(",")}</span>
      <span data-testid="tabs">{tabs.map((t) => t.slot.name).join(",")}</span>
    </div>
  );
}

const failingLoader = () => Promise.reject(new Error("remoteEntry fetch failed"));
const argocdLoader = () => Promise.resolve(argocdExtension);

describe("ExtensionsProvider", () => {
  it("loads remotes through the injected loader and exposes their slots", async () => {
    render(
      <ExtensionsProvider initialRemotes={[argocdRemote]} loader={argocdLoader}>
        <Probe />
      </ExtensionsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("entries")).toHaveTextContent("inari-ext-argocd:ready"),
    );
    expect(screen.getByTestId("tabs")).toHaveTextContent("argocd-health");
  });

  it("marks a remote failed when loading throws and keeps the shell working", async () => {
    render(
      <ExtensionsProvider initialRemotes={[argocdRemote]} loader={failingLoader}>
        <Probe />
      </ExtensionsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("entries")).toHaveTextContent("inari-ext-argocd:failed"),
    );
    expect(screen.getByTestId("tabs")).toHaveTextContent("");
  });

  it("threads the ExtensionLoadError cause (URL + status) into the failed entry", async () => {
    const entryUrl = "https://ext.example.com/remoteEntry.js";
    const failing: typeof failingLoader = () =>
      Promise.reject(
        new ExtensionLoadError(entryUrl, `Failed to fetch remoteEntry ${entryUrl}: HTTP 502 — upstream connect error`, { status: 502 }),
      );
    function ErrorProbe() {
      const { entries } = useExtensions();
      const failed = entries.find((e) => e.state === "failed");
      return (
        <div>
          <span data-testid="error">{failed?.error}</span>
          <span data-testid="error-url">{failed?.errorUrl}</span>
          <span data-testid="error-status">{failed?.errorStatus ?? ""}</span>
        </div>
      );
    }
    render(
      <ExtensionsProvider initialRemotes={[argocdRemote]} loader={failing}>
        <ErrorProbe />
      </ExtensionsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("HTTP 502"),
    );
    expect(screen.getByTestId("error")).toHaveTextContent(entryUrl);
    expect(screen.getByTestId("error-url")).toHaveTextContent(entryUrl);
    expect(screen.getByTestId("error-status")).toHaveTextContent("502");
  });

  it("skips disabled remotes", async () => {
    const disabled: UiExtensionRemoteViewModel = { ...argocdRemote, enabled: false };
    render(
      <ExtensionsProvider initialRemotes={[disabled]} loader={argocdLoader}>
        <Probe />
      </ExtensionsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("entries")).toHaveTextContent("");
  });
});
