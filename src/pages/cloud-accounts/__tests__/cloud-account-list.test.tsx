import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudAccountListPage } from "@/pages/cloud-accounts/cloud-account-list";
import { mockControl } from "@/mocks/fixtures";
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
afterEach(() => mockServer.resetHandlers());
beforeEach(() => {
  mockTenant = "acme";
  mockControl.reset();
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderList() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/cloud-accounts`]}>
      <Routes>
        <Route path="/:tenant/cloud-accounts" element={<CloudAccountListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CloudAccountListPage", () => {
  it("lists seeded accounts with account IDs, regions and status badges", async () => {
    renderList();
    expect(await screen.findByText("acme-prod")).toBeInTheDocument();
    expect(screen.getByText("acme-sandbox")).toBeInTheDocument();
    expect(screen.getAllByText("123456789012").length).toBeGreaterThan(0);
    expect(screen.getAllByText("eu-west-1").length).toBeGreaterThan(0);
    expect(screen.getByTestId("status-connected")).toBeInTheDocument();
    expect(screen.getByTestId("status-pending_trust")).toBeInTheDocument();
  });

  it("links account names to detail pages", async () => {
    renderList();
    const link = await screen.findByRole("link", { name: "acme-prod" });
    expect(link).toHaveAttribute("href", "/acme/cloud-accounts/ca-acme-prod");
  });

  it("shows the ProviderConfigs section for validated accounts", async () => {
    renderList();
    expect(await screen.findByText("ProviderConfigs")).toBeInTheDocument();
    expect(screen.getAllByText("aws-acme-prod").length).toBeGreaterThan(0);
  });

  it("has a connect wizard link in the header", async () => {
    renderList();
    await screen.findByText("acme-prod");
    expect(
      screen.getByRole("link", { name: "Connect AWS account" }),
    ).toHaveAttribute("href", "/acme/cloud-accounts/new");
  });

  it("shows an empty state with CTA when no accounts exist", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/cloud-accounts", () =>
        HttpResponse.json({ accounts: [] }),
      ),
    );
    renderList();
    expect(await screen.findByText(/No cloud accounts connected yet/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Connect your first account" }),
    ).toHaveAttribute("href", "/acme/cloud-accounts/new");
  });
});
