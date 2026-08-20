import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RbacMatrixPage } from "@/pages/rbac/rbac-matrix";
import { m3MockControl } from "@/mocks/fixtures/m3";
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
  m3MockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/rbac`]}>
      <Routes>
        <Route path="/:tenant/rbac" element={<RbacMatrixPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RbacMatrixPage", () => {
  it("renders the groups × roles matrix with the Keycloak-only notice", async () => {
    renderPage();
    expect(
      await screen.findByText(/Group membership is managed in Keycloak only/),
    ).toBeInTheDocument();
    expect(screen.getByText("tenant-acme/platform-team")).toBeInTheDocument();
    expect(screen.getByText("tenant-acme/developers")).toBeInTheDocument();
    expect(screen.getByText("tenant-acme/data")).toBeInTheDocument();
    expect(screen.getAllByText("tenant-acme-operator").length).toBeGreaterThan(0);
    expect(screen.getAllByText("tenant-acme-viewer").length).toBeGreaterThan(0);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows seeded mappings as pressed toggles", async () => {
    renderPage();
    await screen.findByText("tenant-acme/platform-team");
    expect(
      screen.getByRole("button", {
        name: "Map tenant-acme/platform-team to tenant-acme-operator",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", {
        name: "Map tenant-acme/data to tenant-acme-operator",
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("toggling a cell persists the mapping and refetches", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("tenant-acme/data");
    const cell = screen.getByRole("button", {
      name: "Map tenant-acme/data to tenant-acme-viewer",
    });
    expect(cell).toHaveAttribute("aria-pressed", "false");
    await user.click(cell);
    await waitFor(() => expect(cell).toHaveAttribute("aria-pressed", "true"));
    await user.click(cell);
    await waitFor(() => expect(cell).toHaveAttribute("aria-pressed", "false"));
  });

  it("renders an error message when the API fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/rbac", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/Failed to load RBAC matrix: boom/)).toBeInTheDocument();
  });

  it("surfaces an error when saving a mapping fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.put("*/api/v1/tenants/acme/rbac/mappings", () =>
        HttpResponse.json({ detail: "mapping rejected" }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("tenant-acme/data");
    await user.click(
      screen.getByRole("button", { name: "Map tenant-acme/data to tenant-acme-viewer" }),
    );
    expect(await screen.findByText("mapping rejected")).toBeInTheDocument();
  });
});
