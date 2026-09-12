import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityCard } from "@/pages/overview/activity-card";
import { AllTenantsHome } from "@/pages/overview/all-tenants-home";
import { m3MockControl } from "@/mocks/fixtures/m3";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

let mockTenant = "acme";
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant, recents: [] }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
  m3MockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  mockControl.reset();
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function serverInstance(id: string, name: string, updatedAt: string) {
  return {
    id,
    orgId: "acme",
    catalogItemId: "cat-postgresql-aws",
    version: "1.0.0",
    clusterId: "cl-1",
    resourceRef: { kind: "RDSInstance", name, namespace: "default" },
    health: "healthy",
    state: "Synced",
    spec: {},
    generation: 1,
    managementMode: "adopt",
    newVersionAvailable: false,
    createdAt: updatedAt,
    updatedAt,
  };
}

function renderCard() {
  return render(
    <MemoryRouter initialEntries={["/acme/overview"]}>
      <Routes>
        <Route path="/:tenant/overview" element={<ActivityCard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ActivityCard (per-tenant)", () => {
  it("lists recent instances newest-first with a link to deploys", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/instances", () =>
        HttpResponse.json({
          instances: [
            serverInstance("ri-old", "old-db", "2026-09-01T00:00:00Z"),
            serverInstance("ri-new", "new-db", "2026-09-09T00:00:00Z"),
            serverInstance("ri-mid", "mid-db", "2026-09-05T00:00:00Z"),
          ],
        }),
      ),
    );

    renderCard();
    const card = await screen.findByTestId("card-activity");
    await within(card).findByText("new-db");

    const titles = within(card)
      .getAllByRole("paragraph")
      .map((p) => p.textContent)
      .filter((t) => t?.includes("-db"));
    expect(titles[0]).toContain("new-db");
    expect(titles[1]).toContain("mid-db");
    expect(titles[2]).toContain("old-db");
    expect(within(card).getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/acme/deploys",
    );
  });

  it("limits the feed to the newest 10", async () => {
    const instances = Array.from({ length: 12 }, (_, i) =>
      serverInstance(`ri-${i}`, `db-${String(i).padStart(2, "0")}`, `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
    );
    mockServer.use(
      http.get("*/api/v1/tenants/acme/instances", () => HttpResponse.json({ instances })),
    );

    renderCard();
    const card = await screen.findByTestId("card-activity");
    await within(card).findByText("db-11");
    expect(within(card).queryByText("db-01")).not.toBeInTheDocument();
    expect(within(card).queryByText("db-00")).not.toBeInTheDocument();
  });

  it("shows a purpose-built empty state", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/instances", () => HttpResponse.json({ instances: [] })),
    );

    renderCard();
    expect(await screen.findByText(/No recent activity/)).toBeInTheDocument();
  });

  it("hides the card entirely on 403", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/instances", () =>
        HttpResponse.json({ title: "Forbidden", status: 403, detail: "denied" }, { status: 403 }),
      ),
    );

    renderCard();
    await vi.waitFor(() => {
      expect(screen.queryByTestId("card-activity")).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Failed to load/)).not.toBeInTheDocument();
  });

  it("still shows an error with retry on non-403 failures", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/instances", () =>
        HttpResponse.json(
          { title: "Error", status: 500, detail: "boom" },
          { status: 500 },
        ),
      ),
    );

    renderCard();
    const card = await screen.findByTestId("card-activity");
    await within(card).findByText(/Failed to load/);
    expect(within(card).getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("AllTenantsHome activity section", () => {
  function renderHome() {
    mockTenant = "all";
    return render(
      <MemoryRouter initialEntries={["/all/overview"]}>
        <Routes>
          <Route path="/:tenant/overview" element={<AllTenantsHome />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("merges 5 per org into the newest 10 with org labels", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/instances", ({ params }) => {
        const org = params.org as string;
        const base = org === "acme" ? 0 : 20;
        const instances = Array.from({ length: 7 }, (_, i) => ({
          ...serverInstance(
            `${org}-${i}`,
            `${org}-db-${i}`,
            `2026-09-${String(base + i + 1).padStart(2, "0")}T00:00:00Z`,
          ),
          orgId: org,
        }));
        return HttpResponse.json({ instances });
      }),
    );

    renderHome();
    const section = await screen.findByTestId("all-activity");
    // Newest overall is globex-db-6 (2026-09-27).
    await within(section).findByText(/globex-db-6/);
    // 5 per org => 10 rows total; oldest kept is acme-db-2 (2026-09-03).
    expect(within(section).queryByText(/acme-db-1/)).not.toBeInTheDocument();
    const row = within(section).getByText(/acme-db-6/).closest("li");
    expect(row).toHaveTextContent("Acme Corp · acme-db-6");
  });

  it("drops orgs that return 403 instead of showing error chips", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/globex/instances", () =>
        HttpResponse.json({ title: "Forbidden", status: 403, detail: "denied" }, { status: 403 }),
      ),
      http.get("*/api/v1/tenants/acme/instances", () =>
        HttpResponse.json({
          instances: [serverInstance("ri-1", "acme-db", "2026-09-09T00:00:00Z")],
        }),
      ),
    );

    renderHome();
    const section = await screen.findByTestId("all-activity");
    await within(section).findByText(/acme-db/);
    expect(within(section).queryByTestId("org-error-globex")).not.toBeInTheDocument();
  });

  it("hides the section entirely when every org returns 403", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/instances", () =>
        HttpResponse.json({ title: "Forbidden", status: 403, detail: "denied" }, { status: 403 }),
      ),
    );

    renderHome();
    // Wait for a sibling section to settle so the activity fan-out has
    // resolved too, then wait for the card to be gone: on slow CI runners
    // the fan-out can still be in its skeleton state when the sibling
    // settles, so a bare queryByTestId races and flakes.
    const approvals = await screen.findByTestId("all-approvals");
    await within(approvals).findByText(/pending|No pending/i);
    await waitFor(() =>
      expect(screen.queryByTestId("all-activity")).not.toBeInTheDocument(),
    );
  });

  it("shows the empty state when orgs load with no instances and a 403 org", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/globex/instances", () =>
        HttpResponse.json({ title: "Forbidden", status: 403, detail: "denied" }, { status: 403 }),
      ),
      http.get("*/api/v1/tenants/acme/instances", () =>
        HttpResponse.json({ instances: [] }),
      ),
    );

    renderHome();
    const section = await screen.findByTestId("all-activity");
    await within(section).findByText(/No recent activity across your organizations/);
  });
});
