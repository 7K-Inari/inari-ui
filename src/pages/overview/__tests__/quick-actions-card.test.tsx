import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyPermissions } from "@/api/me";
import { PendingApprovalsCard } from "@/pages/overview/pending-approvals-card";
import { QuickActionsCard } from "@/pages/overview/quick-actions-card";
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

let mockPermissions: MyPermissions = { canCreateOrganizations: false };
vi.mock("@/auth/permissions-context", () => ({
  usePermissions: () => mockPermissions,
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
  m3MockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  mockPermissions = { canCreateOrganizations: false };
  mockControl.reset();
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderCard(element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/overview`]}>
      <Routes>
        <Route path="/:tenant/overview" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QuickActionsCard", () => {
  it("shows all actions when the server does not project per-tenant flags", async () => {
    renderCard(<QuickActionsCard />);
    const card = screen.getByTestId("card-quick-actions");
    expect(within(card).getByRole("link", { name: "Register cluster" })).toHaveAttribute(
      "href",
      "/acme/clusters/new",
    );
    expect(within(card).getByRole("link", { name: "Browse catalog" })).toHaveAttribute(
      "href",
      "/acme/catalog",
    );
    expect(
      within(card).getByRole("link", { name: "Connect cloud account" }),
    ).toHaveAttribute("href", "/acme/cloud-accounts/new");
  });

  it("hides actions the projection explicitly denies", async () => {
    mockPermissions = {
      canCreateOrganizations: false,
      tenants: {
        acme: { canRegisterClusters: false, canConnectCloudAccounts: true },
      },
    };
    renderCard(<QuickActionsCard />);
    const card = screen.getByTestId("card-quick-actions");
    expect(within(card).queryByRole("link", { name: "Register cluster" })).not.toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: "Connect cloud account" }),
    ).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Browse catalog" })).toBeInTheDocument();
  });
});

describe("PendingApprovalsCard inline decide", () => {
  it("approve posts the decision and refetches (no optimistic removal)", async () => {
    const user = userEvent.setup();
    let listCalls = 0;
    const decideCalls: { id: string; approve: boolean; reason: string }[] = [];
    mockServer.use(
      http.get("*/api/v1/tenants/acme/approvals", () => {
        listCalls += 1;
        return HttpResponse.json({
          approvals: [
            {
              id: "ap-1",
              orgId: "acme",
              action: "deploy",
              name: "Deploy postgresql-aws 16.3 to eks-prod-eu",
              requester: "jane@acme.example",
              createdAt: new Date().toISOString(),
              state: "pending",
            },
          ],
        });
      }),
      http.post("*/api/v1/tenants/acme/approvals/:id/decide", async ({ params, request }) => {
        const body = (await request.json()) as { approve: boolean; reason: string };
        decideCalls.push({ id: params.id as string, ...body });
        return HttpResponse.json({
          approval: {
            id: params.id,
            orgId: "acme",
            action: "deploy",
            name: "x",
            requester: "jane@acme.example",
            createdAt: new Date().toISOString(),
            state: body.approve ? "approved" : "rejected",
          },
        });
      }),
    );

    renderCard(<PendingApprovalsCard />);
    const card = await screen.findByTestId("card-pending-approvals");
    const title = await within(card).findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
    const row = title.closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Approve" }));

    await vi.waitFor(() => expect(decideCalls).toHaveLength(1));
    expect(decideCalls[0].approve).toBe(true);
    expect(decideCalls[0].reason).toBe("Approved from overview");
    // Decide is followed by a refetch (initial load + post-decide refetch).
    await vi.waitFor(() => expect(listCalls).toBe(2));
  });

  it("surfaces a failed decision inline and keeps the list", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("*/api/v1/tenants/acme/approvals/:id/decide", () =>
        HttpResponse.json(
          { title: "Conflict", status: 409, detail: "already decided" },
          { status: 409 },
        ),
      ),
    );

    renderCard(<PendingApprovalsCard />);
    const card = await screen.findByTestId("card-pending-approvals");
    const title = await within(card).findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
    const row = title.closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Reject" }));

    await within(card).findByRole("alert");
    expect(within(card).getByText(/Decision failed/)).toBeInTheDocument();
    expect(
      within(card).getByText("Deploy postgresql-aws 16.3 to eks-prod-eu"),
    ).toBeInTheDocument();
  });

  it("hides decide buttons when the projection denies canDecideApprovals", async () => {
    mockPermissions = {
      canCreateOrganizations: false,
      tenants: { acme: { canDecideApprovals: false } },
    };

    renderCard(<PendingApprovalsCard />);
    const card = await screen.findByTestId("card-pending-approvals");
    await within(card).findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
    expect(within(card).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });
});
