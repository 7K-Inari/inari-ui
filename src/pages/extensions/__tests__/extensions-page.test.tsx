import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ExtensionsProvider } from "@/ext/registry";
import { m4MockControl } from "@/mocks/fixtures/m4";
import { mockServer } from "@/mocks/server";
import { ExtensionsPage } from "@/pages/extensions/extensions-page";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m4MockControl.reset();
});
afterAll(() => mockServer.close());

// The registry must not actually fetch remoteEntry.js in tests: resolve any
// remote to a minimal valid extension module.
const stubLoader = () =>
  Promise.resolve({
    manifest: { name: "stub", version: "0.0.0", kind: "ui" as const, slots: [] },
    slots: [],
  });

function renderPage() {
  return render(
    <MemoryRouter>
      <ExtensionsProvider loader={stubLoader}>
        <ExtensionsPage />
      </ExtensionsProvider>
    </MemoryRouter>,
  );
}

describe("ExtensionsPage", () => {
  it("lists installed UI extensions with slot kinds and load state", async () => {
    renderPage();
    expect((await screen.findAllByText("inari-ext-argocd")).length).toBeGreaterThan(0);
    expect(screen.getByText("cluster-tab")).toBeInTheDocument();
    expect(screen.getAllByText("instance-action")).toHaveLength(2);
    expect(await screen.findByText("ready")).toBeInTheDocument();
  });

  it("lists backend extensions with health", async () => {
    renderPage();
    expect(await screen.findByText("Backend extensions")).toBeInTheDocument();
    expect(await screen.findByText("healthy")).toBeInTheDocument();
  });

  it("adds a remote via the form", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText("inari-ext-argocd");
    await user.type(screen.getByLabelText("Name"), "cost-ext");
    await user.type(
      screen.getByLabelText("remoteEntry URL / OCI reference"),
      "/extensions/cost-ext/remoteEntry.js",
    );
    await user.click(screen.getByRole("button", { name: "Add remote" }));
    expect((await screen.findAllByText("cost-ext")).length).toBeGreaterThan(0);
  });

  it("surfaces server validation errors when adding a remote", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText("inari-ext-argocd");
    await user.type(screen.getByLabelText("Name"), "Bad Name");
    await user.type(screen.getByLabelText("remoteEntry URL / OCI reference"), "/x.js");
    await user.click(screen.getByRole("button", { name: "Add remote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "name must be lowercase alphanumeric with dashes",
    );
  });

  it("removes an installed extension", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText("inari-ext-argocd");
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await screen.findByText(/No UI extensions installed/);
    // Only the backend extensions table still references the name.
    expect(screen.queryAllByText("inari-ext-argocd")).toHaveLength(1);
  });
});
