import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { m3MockControl } from "@/mocks/fixtures/m3";
import { mockServer } from "@/mocks/server";
import { PlatformResourcesSection } from "@/pages/resources/platform-resources-section";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

let mockTenant = "acme";
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

beforeAll(() => mockServer.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m3MockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderSection() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/deploys`]}>
      <PlatformResourcesSection />
    </MemoryRouter>,
  );
}

describe("PlatformResourcesSection", () => {
  it("renders platform resource rows with native-kind labels and status badges", async () => {
    renderSection();
    const section = await screen.findByRole("region", { name: "Platform resources" });
    // The dns-zone row is backed by a native ExternalDNS DNSEndpoint; the
    // tenant-namespace row by a KRO tenantnamespace instance (render cutover).
    expect(await within(section).findByText("DNSEndpoint")).toBeInTheDocument();
    expect(within(section).getByText("Tenant namespace")).toBeInTheDocument();
    expect(within(section).getByText("Keycloak realm")).toBeInTheDocument();
    expect(within(section).getByText("Keycloak client")).toBeInTheDocument();
    expect(within(section).getByText("tenant-acme")).toBeInTheDocument();
    expect(within(section).getAllByText("Ready").length).toBe(3);
    expect(within(section).getByText("Reconciling")).toBeInTheDocument();
    // Old facade-CRD framing is gone.
    expect(within(section).queryByText(/DNS zone/)).not.toBeInTheDocument();
  });

  it("wires the section to the cluster addons management surface", async () => {
    renderSection();
    const section = await screen.findByRole("region", { name: "Platform resources" });
    const link = await within(section).findByRole("link", { name: "external-dns addon" });
    expect(link).toHaveAttribute("href", "/acme/clusters");
    // KRO instances and hub-provisioned rows have no addon surface.
    expect(within(section).getByText("KRO tenantnamespace")).toBeInTheDocument();
    expect(within(section).getAllByText("Platform hub").length).toBe(2);
    // Section-level pointer to the addons page (cert-manager/ExternalDNS/ArgoCD).
    expect(
      within(section).getByRole("link", { name: "Addons page" }),
    ).toHaveAttribute("href", "/acme/clusters");
  });

  it("falls back to the raw kind for kinds outside the known set", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/platform-resources", () =>
        HttpResponse.json({
          resources: [
            {
              id: "pr-future",
              tenant: "acme",
              kind: "future-kind",
              name: "future-thing",
              status: "ready",
              detail: "a kind the UI does not know yet",
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ),
    );
    renderSection();
    const section = await screen.findByRole("region", { name: "Platform resources" });
    expect(await within(section).findByText("future-kind")).toBeInTheDocument();
    expect(within(section).getByText("—")).toBeInTheDocument();
  });

  it("shows an empty state when the tenant has no platform resources", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/platform-resources", () =>
        HttpResponse.json({ resources: [] }),
      ),
    );
    renderSection();
    expect(
      await screen.findByText("No platform resources for this tenant yet."),
    ).toBeInTheDocument();
  });

  it("renders nothing in the all-tenants view (the endpoint is tenant-scoped)", async () => {
    mockTenant = "all";
    renderSection();
    expect(screen.queryByRole("region", { name: "Platform resources" })).not.toBeInTheDocument();
  });
});
