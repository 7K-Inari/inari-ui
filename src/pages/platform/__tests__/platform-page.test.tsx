import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformPage } from "@/pages/platform/platform-page";
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
    <MemoryRouter initialEntries={[`/${mockTenant}/platform`]}>
      <PlatformPage />
    </MemoryRouter>,
  );
}

describe("PlatformPage", () => {
  it("renders platform cluster apps from the catalog (source=platform)", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Platform cluster apps" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Keycloak Realm")).toBeInTheDocument();
    expect(screen.getByText("0.9.0")).toBeInTheDocument();
    // curated/discovered catalog items are filtered out
    expect(screen.queryByText("cert-manager")).not.toBeInTheDocument();
  });

  it("renders tenant platform resources with kind and status badges", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Tenant platform resources" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Reconciled by inari-operator:/)).toBeInTheDocument();
    expect(await screen.findByText("acme.apps.inari.dev")).toBeInTheDocument();
    expect(screen.getByText("tenant-acme")).toBeInTheDocument();
    expect(screen.getByText("DNS zone")).toBeInTheDocument();
    expect(screen.getByText("Namespace")).toBeInTheDocument();
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(screen.getByText("Reconciling")).toBeInTheDocument();
  });
});
