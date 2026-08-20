import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ZoneListPage } from "@/pages/zones/zone-list";
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

function renderList() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/tenant-zones`]}>
      <Routes>
        <Route path="/:tenant/tenant-zones" element={<ZoneListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ZoneListPage", () => {
  it("lists seeded zones with status badges and step progress", async () => {
    renderList();
    expect(await screen.findByRole("link", { name: "acme-core" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "acme-analytics" })).toBeInTheDocument();
    expect(screen.getByTestId("zone-status-active")).toBeInTheDocument();
    expect(screen.getByTestId("zone-status-provisioning")).toBeInTheDocument();
    expect(screen.getByText("4/4 steps")).toBeInTheDocument();
    expect(screen.getByText("3/4 steps")).toBeInTheDocument();
    expect(screen.getAllByText("starter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("eu-west-1").length).toBeGreaterThan(0);
  });

  it("has a vend wizard link in the header", async () => {
    renderList();
    await screen.findByRole("link", { name: "acme-core" });
    expect(screen.getByRole("link", { name: "Vend new zone" })).toHaveAttribute(
      "href",
      "/acme/tenant-zones/new",
    );
  });

  it("links zone names to detail pages", async () => {
    renderList();
    const link = await screen.findByRole("link", { name: "acme-core" });
    expect(link).toHaveAttribute("href", "/acme/tenant-zones/zn-acme-core");
  });
});
