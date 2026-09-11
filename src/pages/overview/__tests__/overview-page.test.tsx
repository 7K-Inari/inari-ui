import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OverviewPage } from "@/pages/overview/overview-page";
import { m3MockControl } from "@/mocks/fixtures/m3";
import { mockControl } from "@/mocks/fixtures";
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
  mockControl.reset();
  m3MockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  mockControl.reset();
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/overview`]}>
      <Routes>
        <Route path="/:tenant/overview" element={<OverviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function serverApproval(id: string, title: string) {
  return {
    id,
    orgId: "acme",
    action: "deploy",
    name: title,
    requester: "jane@acme.example",
    createdAt: new Date().toISOString(),
    state: "pending",
    clusterId: "",
    itemId: "",
    version: "",
    spec: {},
  };
}

describe("OverviewPage", () => {
  it("shows cluster health counts and pending approvals with links", async () => {
    renderPage();

    const clusterCard = await screen.findByTestId("card-cluster-health");
    await within(clusterCard).findByText("2");
    expect(within(clusterCard).getByText("Connected")).toBeInTheDocument();
    expect(within(clusterCard).getByText("Degraded")).toBeInTheDocument();
    expect(
      within(clusterCard).getByRole("link", { name: /view all/i }),
    ).toHaveAttribute("href", "/acme/clusters");

    const approvalsCard = screen.getByTestId("card-pending-approvals");
    await within(approvalsCard).findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
    expect(within(approvalsCard).getByText("jane@acme.example")).toBeInTheDocument();
    expect(
      within(approvalsCard).getByRole("link", { name: /view all/i }),
    ).toHaveAttribute("href", "/acme/approvals");
  });

  it("shows only the top 5 approvals plus the total pending count", async () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      serverApproval(`ap-x${i}`, `Pending request ${i + 1}`),
    );
    mockServer.use(
      http.get("*/api/v1/tenants/acme/approvals", () =>
        HttpResponse.json({ approvals: items }),
      ),
    );

    renderPage();
    const card = await screen.findByTestId("card-pending-approvals");
    await within(card).findByText("Pending request 1");
    expect(within(card).getByText("Pending request 5")).toBeInTheDocument();
    expect(within(card).queryByText("Pending request 6")).not.toBeInTheDocument();
    expect(
      within(card).getByText((_, el) => el?.textContent === "7 pending"),
    ).toBeInTheDocument();
  });

  it("renders purpose-built empty states", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters", () =>
        HttpResponse.json({ clusters: [] }),
      ),
      http.get("*/api/v1/tenants/acme/approvals", () =>
        HttpResponse.json({ approvals: [] }),
      ),
    );

    renderPage();
    expect(await screen.findByText(/No clusters registered yet/)).toBeInTheDocument();
    expect(await screen.findByText(/No pending approvals/)).toBeInTheDocument();
  });

  it("polls approvals every 15s and clusters every 30s", async () => {
    vi.useFakeTimers();
    try {
      let clusterCalls = 0;
      let approvalCalls = 0;
      mockServer.use(
        http.get("*/api/v1/tenants/acme/clusters", () => {
          clusterCalls += 1;
          return HttpResponse.json({ clusters: [] });
        }),
        http.get("*/api/v1/tenants/acme/approvals", () => {
          approvalCalls += 1;
          return HttpResponse.json({ approvals: [] });
        }),
      );

      renderPage();
      await act(async () => {});
      expect(clusterCalls).toBe(1);
      expect(approvalCalls).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(approvalCalls).toBe(2);
      expect(clusterCalls).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(approvalCalls).toBe(3);
      expect(clusterCalls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows resource health counts and upgrade availability with links", async () => {
    renderPage();

    const card = await screen.findByTestId("card-resource-health");
    await within(card).findByText("2");
    expect(within(card).getByText("healthy")).toBeInTheDocument();
    expect(within(card).getByText("progressing")).toBeInTheDocument();
    const upgrades = within(card).getByRole("link", { name: "1 upgrade available" });
    expect(upgrades).toHaveAttribute("href", "/acme/deploys");
    expect(within(card).getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/acme/deploys",
    );
  });

  it("shows open drift count and latest events, filtering to status=open", async () => {
    renderPage();

    const card = await screen.findByTestId("card-drift");
    await within(card).findByText("2");
    expect(within(card).getByText("Deployment/payments-api")).toBeInTheDocument();
    expect(within(card).getByText("ConfigMap/ingress-config")).toBeInTheDocument();
    // The resolved fixture event is filtered out by status=open.
    expect(within(card).queryByText(/redis-cache/)).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/acme/fleet?tab=drift",
    );
  });

  it("shows only the latest 3 drift events plus the total open count", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/drift", () =>
        HttpResponse.json({
          driftEvents: [4, 3, 2, 1].map((h) => ({
            id: `drift-x${h}`,
            orgId: "acme",
            clusterId: "c-eu-1",
            kind: "Deployment",
            resourceRef: `workload-${h}`,
            status: "open",
            detectedAt: new Date(Date.now() - h * 3600_000).toISOString(),
          })),
        }),
      ),
    );

    renderPage();
    const card = await screen.findByTestId("card-drift");
    await within(card).findByText("4");
    expect(within(card).getByText("Deployment/workload-1")).toBeInTheDocument();
    expect(within(card).getByText("Deployment/workload-3")).toBeInTheDocument();
    expect(within(card).queryByText("Deployment/workload-4")).not.toBeInTheDocument();
  });

  it("renders purpose-built empty states for resources and drift", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/acme/instances", () => HttpResponse.json({ instances: [] })),
      http.get("*/api/v1/tenants/acme/drift", () => HttpResponse.json({ driftEvents: [] })),
    );

    renderPage();
    expect(await screen.findByText(/No resources deployed yet/)).toBeInTheDocument();
    expect(await screen.findByText(/No open drift detected/)).toBeInTheDocument();
  });

  it("polls instances and drift every 30s", async () => {
    vi.useFakeTimers();
    try {
      let instanceCalls = 0;
      let driftCalls = 0;
      mockServer.use(
        http.get("*/api/v1/tenants/acme/instances", () => {
          instanceCalls += 1;
          return HttpResponse.json({ instances: [] });
        }),
        http.get("*/api/v1/tenants/acme/drift", () => {
          driftCalls += 1;
          return HttpResponse.json({ driftEvents: [] });
        }),
      );

      renderPage();
      await act(async () => {});
      // Two cards consume /instances now (resource health + recent activity).
      expect(instanceCalls).toBe(2);
      expect(driftCalls).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      // Only the resource-health card polls at 30s; activity polls at 60s.
      expect(instanceCalls).toBe(3);
      expect(driftCalls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps other cards working when drift fails, and recovers on retry", async () => {
    const user = userEvent.setup();
    let failing = true;
    mockServer.use(
      http.get("*/api/v1/tenants/acme/drift", () => {
        if (failing) {
          return HttpResponse.json(
            { title: "Internal Server Error", status: 500, detail: "boom" },
            { status: 500 },
          );
        }
        return HttpResponse.json({ driftEvents: [] });
      }),
    );

    renderPage();
    const driftCard = await screen.findByTestId("card-drift");
    expect(await within(driftCard).findByText(/Failed to load/)).toBeInTheDocument();

    // Failure isolation: the resource health card still renders its content.
    const resourceCard = screen.getByTestId("card-resource-health");
    await within(resourceCard).findByText("2");

    failing = false;
    await user.click(within(driftCard).getByRole("button", { name: /retry/i }));
    expect(await within(driftCard).findByText(/No open drift detected/)).toBeInTheDocument();
  });

  it("keeps other cards working when one fails, and recovers on retry", async () => {
    const user = userEvent.setup();
    let failing = true;
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters", () => {
        if (failing) {
          return HttpResponse.json(
            { title: "Internal Server Error", status: 500, detail: "boom" },
            { status: 500 },
          );
        }
        return HttpResponse.json({ clusters: [] });
      }),
    );

    renderPage();
    const clusterCard = await screen.findByTestId("card-cluster-health");
    expect(
      await within(clusterCard).findByText(/Failed to load/),
    ).toBeInTheDocument();

    // Failure isolation: the approvals card still renders its content.
    const approvalsCard = screen.getByTestId("card-pending-approvals");
    await within(approvalsCard).findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");

    failing = false;
    await user.click(within(clusterCard).getByRole("button", { name: /retry/i }));
    expect(await within(clusterCard).findByText(/No clusters registered yet/)).toBeInTheDocument();
  });
});
