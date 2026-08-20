import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalsPage } from "@/pages/approvals/approvals-page";
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
    <MemoryRouter initialEntries={[`/${mockTenant}/approvals`]}>
      <Routes>
        <Route path="/:tenant/approvals" element={<ApprovalsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApprovalsPage", () => {
  it("inbox lists pending requests with approve/reject actions", async () => {
    renderPage();
    expect(await screen.findByText("Deploy postgresql-aws 16.3 to eks-prod-eu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByText("jane@acme.example")).toBeInTheDocument();
  });

  it("requires a reason before confirming a decision", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("button", { name: "Confirm approve" })).toBeDisabled();
    await user.type(screen.getByLabelText("Decision reason"), "Looks good");
    const confirm = screen.getByRole("button", { name: "Confirm approve" });
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    const row = (await screen.findByText("Looks good")).closest("tr")!;
    expect(within(row).getByText("approved")).toBeInTheDocument();
    expect(screen.queryByLabelText("Decision reason")).not.toBeInTheDocument();
    expect(within(row).getByText("me@inari.dev")).toBeInTheDocument();
  });

  it("rejects with a reason", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByLabelText("Decision reason"), "Not compliant");
    await user.click(screen.getByRole("button", { name: "Confirm reject" }));
    const row = (await screen.findByText("Not compliant")).closest("tr")!;
    expect(within(row).getByText("rejected")).toBeInTheDocument();
  });

  it("requested tab shows own requests including rejected with reason", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Deploy postgresql-aws 16.3 to eks-prod-eu");
    await user.click(screen.getByRole("button", { name: "Requested" }));
    expect(await screen.findByText("Deploy nginx-ingress to kind-dev")).toBeInTheDocument();
    expect(screen.getByText("Vend tenant zone acme-analytics")).toBeInTheDocument();
    expect(screen.queryByText("Deploy postgresql-aws 16.3 to eks-prod-eu")).not.toBeInTheDocument();
    expect(screen.getByText("Use the platform-managed ingress instead.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("shows an empty state when a view has no requests", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/approvals", () =>
        HttpResponse.json({ approvals: [] }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/Nothing waiting for your decision/)).toBeInTheDocument();
  });

  it("renders an error message when the API fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/approvals", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();
    const alert = await screen.findByText(/Failed to load approvals: boom/);
    expect(within(alert).getByText(/boom/)).toBeInTheDocument();
  });
});
