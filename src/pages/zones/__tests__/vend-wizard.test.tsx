import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { VendZoneWizardPage } from "@/pages/zones/vend-wizard";
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

function DetailStub() {
  const { zoneId } = useParams();
  return <div>zone detail {zoneId}</div>;
}

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/tenant-zones/new`]}>
      <Routes>
        <Route path="/:tenant/tenant-zones/new" element={<VendZoneWizardPage />} />
        <Route path="/:tenant/tenant-zones/:zoneId" element={<DetailStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VendZoneWizardPage", () => {
  it("validates the slug format client-side", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText("Name"), "Bad Zone");
    await user.type(screen.getByLabelText("Slug"), "Bad_Slug");
    await user.type(screen.getByLabelText("Org unit"), "acme-data");
    await user.click(screen.getByRole("button", { name: "Vend zone" }));
    expect(await screen.findByText(/lowercase letters, numbers, and dashes/)).toBeInTheDocument();
    expect(screen.queryByText(/^zone detail /)).not.toBeInTheDocument();
  });

  it("only offers the starter tier", () => {
    renderWizard();
    const tier = screen.getByLabelText("Tier") as HTMLSelectElement;
    expect(tier.disabled).toBe(true);
    expect(tier.value).toBe("starter");
    expect(screen.getByText("Starter tier only during M3.")).toBeInTheDocument();
  });

  it("vends a zone and navigates to its detail page", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText("Name"), "acme-ml");
    await user.type(screen.getByLabelText("Slug"), "acme-ml");
    await user.type(screen.getByLabelText("Org unit"), "acme-data");
    await user.selectOptions(screen.getByLabelText("Region"), "eu-central-1");
    await user.click(screen.getByRole("button", { name: "Vend zone" }));
    expect(await screen.findByText("zone detail zn-acme-acme-ml")).toBeInTheDocument();
  });
});
