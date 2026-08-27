import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ClusterListPage } from "@/pages/clusters/cluster-list";
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
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  mockControl.reset();
});
afterAll(() => mockServer.close());

function renderList() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/clusters`]}>
      <Routes>
        <Route path="/:tenant/clusters" element={<ClusterListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ClusterListPage", () => {
  it("lists tenant-scoped clusters with status, version, labels and last seen", async () => {
    renderList();
    expect(await screen.findByText("kind-dev")).toBeInTheDocument();
    expect(screen.getByText("eks-prod-eu")).toBeInTheDocument();
    expect(screen.queryByText("gke-staging")).not.toBeInTheDocument();
    expect(screen.getByText("v1.30.2")).toBeInTheDocument();
    expect(screen.getAllByText("env=dev").length).toBeGreaterThan(0);
    expect(screen.queryByRole("columnheader", { name: "Tenant" })).not.toBeInTheDocument();
  });

  it("asks for a tenant selection in the all-tenants view (server endpoints are tenant-scoped)", async () => {
    mockTenant = "all";
    renderList();
    expect(await screen.findByText(/select a specific tenant/i)).toBeInTheDocument();
  });

  it("filters clusters by status", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText("kind-dev");
    await user.click(screen.getByRole("button", { name: "Degraded" }));
    expect(screen.queryByText("kind-dev")).not.toBeInTheDocument();
    expect(screen.getByText("eks-prod-eu")).toBeInTheDocument();
  });

  it("shows an empty state with register CTA when no clusters exist", async () => {
    mockControl.getState().clusters = [];
    renderList();
    expect(
      await screen.findByText(/No clusters registered yet/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Register your first cluster" }),
    ).toHaveAttribute("href", "/acme/clusters/new");
  });

  it("links cluster names to detail pages", async () => {
    renderList();
    const link = await screen.findByRole("link", { name: "kind-dev" });
    expect(link).toHaveAttribute("href", "/acme/clusters/cl-kind-dev");
  });

  it("renders an error message when the API fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderList();
    expect(await screen.findByText(/Failed to load clusters: boom/)).toBeInTheDocument();
  });

  it("has a register wizard link in the header", async () => {
    renderList();
    await screen.findByText("kind-dev");
    const header = screen.getByRole("heading", { name: "Clusters" }).parentElement!;
    expect(
      within(header.parentElement!).getAllByRole("link", { name: "Register cluster" })[0],
    ).toHaveAttribute("href", "/acme/clusters/new");
  });

  it("shows resume and cancel actions only for pending clusters", async () => {
    mockControl.setClusterStatus("cl-eks-prod", "pending");
    renderList();
    const pendingRow = (await screen.findByText("eks-prod-eu")).closest("tr")!;
    expect(
      within(pendingRow).getByRole("link", { name: "Resume registration" }),
    ).toHaveAttribute("href", "/acme/clusters/new?cluster=cl-eks-prod");
    expect(
      within(pendingRow).getByRole("button", { name: "Cancel registration" }),
    ).toBeInTheDocument();

    const connectedRow = screen.getByText("kind-dev").closest("tr")!;
    expect(
      within(connectedRow).queryByRole("link", { name: "Resume registration" }),
    ).not.toBeInTheDocument();
    expect(
      within(connectedRow).queryByRole("button", { name: "Cancel registration" }),
    ).not.toBeInTheDocument();
  });

  it("cancels a pending registration after confirmation and removes the row", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockControl.setClusterStatus("cl-eks-prod", "pending");
    renderList();
    const pendingRow = (await screen.findByText("eks-prod-eu")).closest("tr")!;
    await user.click(within(pendingRow).getByRole("button", { name: "Cancel registration" }));
    expect(window.confirm).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(screen.queryByText("eks-prod-eu")).not.toBeInTheDocument();
    });
    expect(mockControl.getState().clusters.map((c) => c.id)).not.toContain("cl-eks-prod");
    vi.restoreAllMocks();
  });

  it("keeps the row when the confirmation is declined", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mockControl.setClusterStatus("cl-eks-prod", "pending");
    renderList();
    const pendingRow = (await screen.findByText("eks-prod-eu")).closest("tr")!;
    await user.click(within(pendingRow).getByRole("button", { name: "Cancel registration" }));
    expect(screen.getByText("eks-prod-eu")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("surfaces API errors when cancelling fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.delete("*/api/v1/tenants/acme/clusters/:id", () =>
        HttpResponse.json({ detail: "forbidden" }, { status: 403 }),
      ),
    );
    mockControl.setClusterStatus("cl-eks-prod", "pending");
    renderList();
    const pendingRow = (await screen.findByText("eks-prod-eu")).closest("tr")!;
    await user.click(within(pendingRow).getByRole("button", { name: "Cancel registration" }));
    expect(await screen.findByText(/forbidden/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
