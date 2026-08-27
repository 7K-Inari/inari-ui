import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterWizardPage } from "@/pages/clusters/register-wizard";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

let mockTenant = "acme";
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
beforeEach(() => {
  mockTenant = "acme";
  mockControl.reset();
});
afterAll(() => mockServer.close());

function renderWizard(initialEntry = "/acme/clusters/new") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:tenant/clusters/new" element={<RegisterWizardPage />} />
        <Route path="/:tenant/clusters/:id" element={<div>detail page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "kind-m1");
  await user.clear(screen.getByLabelText("Labels"));
  await user.type(screen.getByLabelText("Labels"), "env=dev, team=platform");
  await user.click(screen.getByRole("button", { name: "Create registration token" }));
}

describe("RegisterWizardPage", () => {
  it("validates the cluster name format", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText("Name"), "Bad_Name");
    await user.click(screen.getByRole("button", { name: "Create registration token" }));
    expect(await screen.findByText(/lowercase letters, numbers, and dashes/)).toBeInTheDocument();
    expect(mockControl.getState().clusters.some((c) => c.name === "Bad_Name")).toBe(false);
  });

  it("registers the cluster under the current tenant and shows the one-time token with install manifest", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);

    const tokenEl = await screen.findByTestId("registration-token");
    expect(tokenEl.textContent).toMatch(/^inari-reg-/);
    expect(screen.getByText(/Token expires in 1[0-5]:/)).toBeInTheDocument();

    const created = mockControl.getState().clusters.find((c) => c.name === "kind-m1")!;
    expect(created.tenant).toBe("acme");
    expect(created.status).toBe("pending");
    expect(created.labels).toEqual({ env: "dev", team: "platform" });

    const manifest = screen.getByText(/kind: Deployment/);
    expect(manifest.textContent).toContain(tokenEl.textContent!);
  });

  it("offers a Helm install tab from the server response", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);
    await screen.findByTestId("registration-token");
    await user.click(screen.getByRole("tab", { name: "Helm" }));
    expect(screen.getByText(/helm install inari-agent/)).toBeInTheDocument();
  });

  it("waits for the agent and celebrates when the cluster comes online", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);
    await screen.findByTestId("registration-token");

    // agent connects before the user advances to the waiting step
    const created = mockControl.getState().clusters.find((c) => c.name === "kind-m1")!;
    mockControl.setClusterStatus(created.id, "connected");

    await user.click(screen.getByRole("button", { name: /watch for connection/ }));
    expect(await screen.findByText("Cluster is online")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open cluster detail" }),
    ).toHaveAttribute("href", `/acme/clusters/${created.id}`);
  });

  it("shows the waiting state while the cluster is pending", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);
    await screen.findByTestId("registration-token");
    await user.click(screen.getByRole("button", { name: /watch for connection/ }));
    expect(
      await screen.findByText("Waiting for the agent to connect…"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("status-pending")).toBeInTheDocument();
  });

  it("surfaces server errors on submit", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText("Name"), "bad$name");
    // client-side pattern allows only after fix; force a server failure instead
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "ok-name");
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.post("*/api/v1/tenants/acme/clusters", () =>
        HttpResponse.json({ message: "quota exceeded" }, { status: 403 }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Create registration token" }));
    expect(await screen.findByText("quota exceeded")).toBeInTheDocument();
  });

  it("resumes the waiting step from a deep link with ?cluster=", async () => {
    mockControl.setClusterStatus("cl-kind-dev", "pending");
    renderWizard("/acme/clusters/new?cluster=cl-kind-dev");
    expect(
      await screen.findByText("Waiting for the agent to connect…"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Cluster "kind-dev"/)).toBeInTheDocument(),
    );
  });

  it("lets a resumed user fetch a fresh install manifest", async () => {
    const user = userEvent.setup();
    mockControl.setClusterStatus("cl-kind-dev", "pending");
    renderWizard("/acme/clusters/new?cluster=cl-kind-dev");
    await screen.findByText("Waiting for the agent to connect…");
    await user.click(screen.getByRole("button", { name: "Show install manifest" }));
    expect(await screen.findByText(/kind: Namespace/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy manifest" }),
    ).toBeInTheDocument();
  });
});
