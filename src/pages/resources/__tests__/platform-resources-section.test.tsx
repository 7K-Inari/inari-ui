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
    // Section-level pointer (design: dedicated ADDONS PAGE → link, no
    // mid-sentence link in the description).
    const sectionLink = await within(section).findByRole("link", { name: "Addons page →" });
    expect(sectionLink).toHaveAttribute("href", "/acme/clusters");
    expect(
      within(section).getByText(/native cert-manager ClusterIssuers, ExternalDNS DNSEndpoints/i),
    ).toBeInTheDocument();
    // Row-level hint for the addon-backed kind.
    const rowLink = await within(section).findByRole("link", { name: "external-dns addon" });
    expect(rowLink).toHaveAttribute("href", "/acme/clusters");
    // KRO instances and hub-provisioned rows have no addon surface.
    expect(within(section).getByText("KRO tenantnamespace")).toBeInTheDocument();
    expect(within(section).getAllByText("Platform hub").length).toBe(2);
  });

  it("falls back to the raw kind and dashes for kinds outside the known set", async () => {
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
              // no detail — design renders an em dash for empty cells
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ),
    );
    renderSection();
    const section = await screen.findByRole("region", { name: "Platform resources" });
    expect(await within(section).findByText("future-kind")).toBeInTheDocument();
    // Detail and Managed by both degrade to "—".
    expect(within(section).getAllByText("—").length).toBe(2);
  });

  it("falls back to a neutral badge with the raw label for unrecognized statuses", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/platform-resources", () =>
        HttpResponse.json({
          resources: [
            {
              id: "pr-weird",
              tenant: "acme",
              kind: "dns-zone",
              name: "weird-status",
              status: "degraded",
              detail: "",
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ),
    );
    renderSection();
    const section = await screen.findByRole("region", { name: "Platform resources" });
    // Raw status string rendered, not mapped to a known tone.
    expect(await within(section).findByText("degraded")).toBeInTheDocument();
    expect(within(section).queryByText("Ready")).not.toBeInTheDocument();
  });

  it("renders the empty state when the API returns resources: null", async () => {
    // Go marshals a nil slice as null; the adapter normalizes to [].
    mockServer.use(
      http.get("*/api/v1/tenants/:org/platform-resources", () =>
        HttpResponse.json({ resources: null }),
      ),
    );
    renderSection();
    const section = await screen.findByRole("region", { name: "Platform resources" });
    expect(await within(section).findByText("No platform resources yet")).toBeInTheDocument();
  });

  it("shows the designed empty state without a CTA", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/platform-resources", () =>
        HttpResponse.json({ resources: [] }),
      ),
    );
    renderSection();
    const section = await screen.findByRole("region", { name: "Platform resources" });
    expect(await within(section).findByText("No platform resources yet")).toBeInTheDocument();
    expect(
      within(section).getByText(/Resources appear here as the platform renders them/i),
    ).toBeInTheDocument();
    // Design: no CTA on the empty card (nothing to browse).
    expect(within(section).queryByRole("link", { name: /browse/i })).not.toBeInTheDocument();
  });

  it("shows the error card without a retry button", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/platform-resources", () =>
        HttpResponse.json({ title: "Error", status: 500, detail: "timeout" }, { status: 500 }),
      ),
    );
    renderSection();
    const section = await screen.findByRole("region", { name: "Platform resources" });
    expect(
      await within(section).findByText(/Failed to load platform resources/),
    ).toBeInTheDocument();
    // Design D4: message-only error cards, no retry.
    expect(within(section).queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("renders nothing in the all-tenants view (the endpoint is tenant-scoped)", async () => {
    mockTenant = "all";
    renderSection();
    expect(screen.queryByRole("region", { name: "Platform resources" })).not.toBeInTheDocument();
  });
});
