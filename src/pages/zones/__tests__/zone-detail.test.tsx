import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ZoneDetailPage } from "@/pages/zones/zone-detail";
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

function renderDetail(zoneId: string) {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/tenant-zones/${zoneId}`]}>
      <Routes>
        <Route path="/:tenant/tenant-zones/:zoneId" element={<ZoneDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ZoneDetailPage", () => {
  it("renders the lifecycle steps for an active zone", async () => {
    renderDetail("zn-acme-core");
    expect(await screen.findByRole("heading", { name: "acme-core" })).toBeInTheDocument();
    expect(screen.getByTestId("zone-status-active")).toBeInTheDocument();
    expect(screen.getByText("Cloud account")).toBeInTheDocument();
    expect(screen.getByText("Trust setup")).toBeInTheDocument();
    expect(screen.getByText("EKS cluster")).toBeInTheDocument();
    expect(screen.getByText("Platform wiring")).toBeInTheDocument();
    expect(screen.getByText("ca-acme-prod")).toBeInTheDocument();
    expect(screen.getByText("cl-eks-prod")).toBeInTheDocument();
  });

  it("shows the decommission form only for active zones and requires a reason", async () => {
    const user = userEvent.setup();
    renderDetail("zn-acme-core");
    await screen.findByRole("heading", { name: "acme-core" });
    const button = screen.getByRole("button", { name: "Request decommission" });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Reason"), "Moving to a shared zone");
    expect(button).toBeEnabled();
  });

  it("shows the approval-gate message after requesting decommission", async () => {
    const user = userEvent.setup();
    renderDetail("zn-acme-core");
    await screen.findByRole("heading", { name: "acme-core" });
    await user.type(screen.getByLabelText("Reason"), "Moving to a shared zone");
    await user.click(screen.getByRole("button", { name: "Request decommission" }));
    expect(
      await screen.findByText(/Teardown is gated on approval/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Approvals inbox/)).toBeInTheDocument();
  });

  it("does not offer decommission for a provisioning zone", async () => {
    // The mock advances provisioning one step per poll; pin a static
    // provisioning response so the zone never reaches active.
    const { http, HttpResponse } = await import("msw");
    const { findZone } = await import("@/mocks/fixtures/m3");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/zones/zn-acme-analytics", () =>
        HttpResponse.json({ zone: structuredClone(findZone("zn-acme-analytics")!) }),
      ),
    );
    renderDetail("zn-acme-analytics");
    expect(await screen.findByRole("heading", { name: "acme-analytics" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request decommission" })).not.toBeInTheDocument();
  });
});
