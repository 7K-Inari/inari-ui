import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";
import { CatalogBrowsePage } from "@/pages/catalog/catalog-browse";

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/catalog`]}>
      <Routes>
        <Route path="/:tenant/catalog" element={<CatalogBrowsePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CatalogBrowsePage", () => {
  it("lists all catalog items with source and category", async () => {
    renderPage();
    expect(await screen.findByText("PostgreSQL on AWS")).toBeInTheDocument();
    expect(screen.getByText("cert-manager")).toBeInTheDocument();
    expect(screen.getByText("Keycloak Realm")).toBeInTheDocument();
    expect(screen.getAllByText("database").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Curated").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Discovered").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0);
  });

  it("filters by source", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    await user.click(screen.getByRole("button", { name: "Curated" }));
    expect(screen.getByText("PostgreSQL on AWS")).toBeInTheDocument();
    expect(screen.queryByText("Keycloak Realm")).not.toBeInTheDocument();
    expect(screen.queryByText("cert-manager")).not.toBeInTheDocument();
  });

  it("filters by cluster compatibility", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    await user.selectOptions(
      screen.getByLabelText("Cluster compatibility"),
      "cl-kind-dev",
    );
    expect(screen.getByText("cert-manager")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL on AWS")).toBeInTheDocument();
    expect(screen.queryByText("Keycloak Realm")).not.toBeInTheDocument();
  });

  it("filters by category", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    await user.selectOptions(screen.getByLabelText("Category"), "identity");
    expect(screen.getByText("Keycloak Realm")).toBeInTheDocument();
    expect(screen.queryByText("PostgreSQL on AWS")).not.toBeInTheDocument();
  });

  it("links items to detail pages carrying tenant context", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /PostgreSQL on AWS/ });
    expect(link).toHaveAttribute("href", "/acme/catalog/cat-postgresql-aws");
  });

  it("renders an error message when the API fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/catalog", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/Failed to load catalog: boom/)).toBeInTheDocument();
  });
});
