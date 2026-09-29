import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { mockControl } from "@/mocks/fixtures";
import { mockCatalogControl } from "@/mocks/fixtures/catalog";
import { mockServer } from "@/mocks/server";
import { ResourceListPage } from "@/pages/resources/resource-list";

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
  mockCatalogControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  mockControl.reset();
  mockCatalogControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/deploys`]}>
      <Routes>
        <Route path="/:tenant/deploys" element={<ResourceListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResourceListPage", () => {
  it("lists tenant instances with health, status, cluster and owner team", async () => {
    renderPage();
    expect(await screen.findByText("orders-db")).toBeInTheDocument();
    expect(screen.getByText("payments-db")).toBeInTheDocument();
    expect(screen.queryByText("globex-apps")).not.toBeInTheDocument();
    // The server contract exposes the cluster ID, not a display name.
    expect(screen.getByText("cl-eks-prod")).toBeInTheDocument();
    expect(screen.getByText("orders-team")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getAllByText(/healthy|progressing/i).length).toBeGreaterThan(0);
  });

  it("asks for a tenant selection in the all-tenants view (server endpoints are tenant-scoped)", async () => {
    mockTenant = "all";
    renderPage();
    expect(await screen.findByText(/select a specific tenant/i)).toBeInTheDocument();
  });

  it("shows an update-available badge", async () => {
    renderPage();
    expect(await screen.findByText(/1\.4\.0 available/)).toBeInTheDocument();
  });

  it("filters by health", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("orders-db");
    await user.click(screen.getByRole("button", { name: "Progressing" }));
    expect(screen.queryByText("orders-db")).not.toBeInTheDocument();
    expect(screen.getByText("payments-db")).toBeInTheDocument();
  });

  it("links instances to detail pages", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "orders-db" });
    expect(link).toHaveAttribute("href", "/acme/deploys/ri-orders-db");
  });
});

describe("row delete", () => {
  it("deletes a resource after confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByText("orders-db");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(confirmSpy).toHaveBeenCalled();
    const { waitFor } = await import("@testing-library/react");
    await waitFor(() => expect(screen.queryByText("orders-db")).not.toBeInTheDocument());
    confirmSpy.mockRestore();
  });

  it("keeps the resource when the confirmation is declined", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByText("orders-db");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(screen.getByText("orders-db")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("surfaces API errors", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.delete("*/api/v1/tenants/acme/instances/:id", () =>
        HttpResponse.json({ title: "Error", status: 500, detail: "boom" }, { status: 500 }),
      ),
    );
    renderPage();
    await screen.findByText("orders-db");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
