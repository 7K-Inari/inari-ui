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

  it("shows a tenant column in the all-tenants view", async () => {
    mockTenant = "all";
    renderList();
    expect(await screen.findByText("gke-staging")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tenant" })).toBeInTheDocument();
    expect(screen.getByText("globex")).toBeInTheDocument();
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
      http.get("*/api/v1/clusters", () =>
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
});
