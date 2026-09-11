import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";
import { ApprovalsConfigPage } from "@/pages/settings/policies/approvals-config";

let mockParsedToken: Record<string, unknown> | undefined = {
  organization: { acme: { name: "Acme", roles: ["admin"] } },
};
vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: mockParsedToken }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
beforeEach(() => {
  mockParsedToken = { organization: { acme: { name: "Acme", roles: ["admin"] } } };
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/acme/settings/policies/approvals"]}>
      <Routes>
        <Route
          path="/:tenant/settings/policies/approvals"
          element={<ApprovalsConfigPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApprovalsConfigPage", () => {
  it("renders the config and links to the approvals inbox", async () => {
    renderPage();
    expect(await screen.findByText("tenant-acme/platform-team")).toBeInTheDocument();
    expect(screen.getAllByText("deploy").length).toBeGreaterThan(0);
    const link = screen.getByRole("link", { name: /approvals inbox/ });
    expect(link).toHaveAttribute("href", "/acme/approvals");
  });

  it("saves edited thresholds via PUT", async () => {
    const bodies: unknown[] = [];
    mockServer.use(
      http.put("*/api/v1/tenants/acme/approval-config", async ({ request }) => {
        bodies.push(await request.json());
        const { putApprovalConfigMock } = await import("@/mocks/fixtures/m6");
        return HttpResponse.json({
          config: putApprovalConfigMock(
            "acme",
            bodies[0] as Parameters<typeof putApprovalConfigMock>[1],
          ),
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByLabelText("Approvals required for deploy");
    await user.clear(input);
    await user.type(input, "3");
    await user.click(screen.getByRole("button", { name: "Save configuration" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    const body = bodies[0] as {
      thresholds: { action: string; approvalsRequired: number }[];
    };
    expect(body.thresholds).toContainEqual({ action: "deploy", approvalsRequired: 3 });
    expect(await screen.findByText("Configuration saved.")).toBeInTheDocument();
  });
});
