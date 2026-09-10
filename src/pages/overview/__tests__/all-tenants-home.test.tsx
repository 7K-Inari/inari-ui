import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AllTenantsHome } from "@/pages/overview/all-tenants-home";
import { m3MockControl } from "@/mocks/fixtures/m3";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

let mockRecents: string[] = [];
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "all", recents: mockRecents }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
  m3MockControl.reset();
});
beforeEach(() => {
  mockRecents = [];
  mockControl.reset();
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/all/overview"]}>
      <Routes>
        <Route path="/:tenant/overview" element={<AllTenantsHome />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AllTenantsHome", () => {
  it("renders org cards from GET /tenants with links to each org overview", async () => {
    renderPage();

    const strip = await screen.findByTestId("tenant-strip");
    const acme = await within(strip).findByRole("link", { name: /acme corp/i });
    expect(acme).toHaveAttribute("href", "/acme/overview");
    expect(within(strip).getByRole("link", { name: /globex inc/i })).toHaveAttribute(
      "href",
      "/globex/overview",
    );
  });

  it("shows recent organizations from the tenant context", async () => {
    mockRecents = ["globex"];
    renderPage();

    const strip = await screen.findByTestId("tenant-strip");
    const recent = await within(strip).findByTestId("recent-globex");
    expect(within(recent).getByRole("link")).toHaveAttribute("href", "/globex/overview");
  });

  it("groups pending approvals by org with links to each org inbox", async () => {
    renderPage();

    const section = await screen.findByTestId("all-approvals");
    const acmeGroup = await within(section).findByTestId("all-approvals-org-acme");
    await within(acmeGroup).findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
    expect(within(acmeGroup).getByRole("link", { name: /acme corp/i })).toHaveAttribute(
      "href",
      "/acme/approvals",
    );

    const globexGroup = within(section).getByTestId("all-approvals-org-globex");
    await within(globexGroup).findByText("Deploy redis-cache to gke-staging");
    expect(within(globexGroup).getByRole("link", { name: /globex inc/i })).toHaveAttribute(
      "href",
      "/globex/approvals",
    );
  });

  it("keeps other orgs working when one org's approvals fail, and recovers on retry", async () => {
    const user = userEvent.setup();
    let failing = true;
    mockServer.use(
      http.get("*/api/v1/tenants/globex/approvals", () => {
        if (failing) {
          return HttpResponse.json(
            { title: "Internal Server Error", status: 500, detail: "boom" },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          approvals: [
            {
              id: "ap-recovered",
              orgId: "globex",
              action: "deploy",
              name: "Deploy redis-cache to gke-staging",
              requester: "joe@globex.example",
              createdAt: new Date().toISOString(),
              state: "pending",
              clusterId: "",
              itemId: "",
              version: "",
              spec: {},
            },
          ],
        });
      }),
    );

    renderPage();
    const section = await screen.findByTestId("all-approvals");
    const acmeGroup = await within(section).findByTestId("all-approvals-org-acme");
    await within(acmeGroup).findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");

    const chip = await within(section).findByTestId("org-error-globex");
    expect(within(chip).getByText(/failed to load/i)).toBeInTheDocument();

    failing = false;
    await user.click(within(chip).getByRole("button", { name: /retry/i }));
    await within(section).findByTestId("all-approvals-org-globex");
  });

  it("renders fast orgs even when one org's request never settles", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/globex/approvals", () => new Promise(() => {})),
    );

    renderPage();
    const section = await screen.findByTestId("all-approvals");
    const acmeGroup = await within(section).findByTestId("all-approvals-org-acme");
    await within(acmeGroup).findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
  });

  it("keeps other orgs working when one org's clusters fail", async () => {    mockServer.use(
      http.get("*/api/v1/tenants/globex/clusters", () =>
        HttpResponse.json(
          { title: "Internal Server Error", status: 500, detail: "boom" },
          { status: 500 },
        ),
      ),
    );

    renderPage();
    const section = await screen.findByTestId("all-clusters");
    await within(section).findByTestId("org-chip-acme");
    expect(await within(section).findByTestId("org-error-globex")).toBeInTheDocument();
  });

  it("caps the fan-out at 10 orgs with an overflow affordance", async () => {
    const orgs = Array.from({ length: 12 }, (_, i) => ({
      id: `t-org${i}`,
      slug: `org${i}`,
      displayName: `Org ${i}`,
      keycloakOrgId: `kc-org${i}`,
      createdAt: new Date().toISOString(),
    }));
    const requested: string[] = [];
    mockServer.use(
      http.get("*/api/v1/tenants", () => HttpResponse.json({ tenants: orgs })),
      http.get("*/api/v1/tenants/:org/approvals", ({ params }) => {
        requested.push(params.org as string);
        return HttpResponse.json({ approvals: [] });
      }),
      http.get("*/api/v1/tenants/:org/clusters", ({ params }) => {
        requested.push(params.org as string);
        return HttpResponse.json({
          clusters: [
            {
              id: `cl-${params.org}`,
              orgId: params.org,
              name: "kind-dev",
              kubernetesVersion: "v1.30.2",
              labels: {},
              state: "active",
              lastSeenAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }),
    );

    renderPage();
    await screen.findByTestId("all-clusters");
    await screen.findByTestId("org-chip-org9");
    expect(screen.queryByTestId("org-chip-org10")).not.toBeInTheDocument();
    expect(screen.getAllByText(/and 2 more organizations/i).length).toBeGreaterThan(0);
    expect(new Set(requested).size).toBeLessThanOrEqual(10);
  });

  it("shows per-org connected/total cluster chips", async () => {
    renderPage();

    const section = await screen.findByTestId("all-clusters");
    const acmeChip = await within(section).findByTestId("org-chip-acme");
    // acme seeds: kind-dev connected, eks-prod-eu degraded.
    expect(within(acmeChip).getByText("1/2")).toBeInTheDocument();
    expect(within(acmeChip).getByRole("link")).toHaveAttribute("href", "/acme/clusters");

    const globexChip = within(section).getByTestId("org-chip-globex");
    expect(within(globexChip).getByText("1/1")).toBeInTheDocument();
  });

  it("renders global empty states when nothing exists across orgs", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/approvals", () => HttpResponse.json({ approvals: [] })),
      http.get("*/api/v1/tenants/:org/clusters", () => HttpResponse.json({ clusters: [] })),
    );

    renderPage();
    expect(
      await screen.findByText(/No pending approvals across your organizations/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/No clusters registered across your organizations/),
    ).toBeInTheDocument();
  });

  it("renders a dedicated empty state when the caller belongs to no orgs", async () => {
    mockServer.use(http.get("*/api/v1/tenants", () => HttpResponse.json({ tenants: [] })));

    renderPage();
    expect(
      await screen.findByText(/You don't belong to any organizations yet/),
    ).toBeInTheDocument();
  });

  it("polls the tenant list and fan-out sections every 60s", async () => {
    vi.useFakeTimers();
    try {
      let tenantCalls = 0;
      let approvalCalls = 0;
      let clusterCalls = 0;
      mockServer.use(
        http.get("*/api/v1/tenants", () => {
          tenantCalls += 1;
          return HttpResponse.json({
            tenants: [
              {
                id: "t-acme",
                slug: "acme",
                displayName: "Acme Corp",
                keycloakOrgId: "kc-acme",
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }),
        http.get("*/api/v1/tenants/:org/approvals", () => {
          approvalCalls += 1;
          return HttpResponse.json({ approvals: [] });
        }),
        http.get("*/api/v1/tenants/:org/clusters", () => {
          clusterCalls += 1;
          return HttpResponse.json({ clusters: [] });
        }),
      );

      renderPage();
      await act(async () => {});
      await act(async () => {});
      expect(tenantCalls).toBe(1);
      expect(approvalCalls).toBe(1);
      expect(clusterCalls).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(59_000);
      });
      expect(tenantCalls).toBe(1);
      expect(approvalCalls).toBe(1);
      expect(clusterCalls).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(tenantCalls).toBe(2);
      expect(approvalCalls).toBe(2);
      expect(clusterCalls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a page-level error with retry when the tenant list fails", async () => {
    const user = userEvent.setup();
    let failing = true;
    mockServer.use(
      http.get("*/api/v1/tenants", () => {
        if (failing) {
          return HttpResponse.json(
            { title: "Internal Server Error", status: 500, detail: "boom" },
            { status: 500 },
          );
        }
        return HttpResponse.json({ tenants: [] });
      }),
    );

    renderPage();
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(
      await screen.findByText(/You don't belong to any organizations yet/),
    ).toBeInTheDocument();
  });
});
