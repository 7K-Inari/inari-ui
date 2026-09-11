import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { VisibilityPage } from "@/pages/settings/policies/visibility";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

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
    <MemoryRouter initialEntries={["/acme/settings/policies/visibility"]}>
      <Routes>
        <Route path="/:tenant/settings/policies/visibility" element={<VisibilityPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VisibilityPage", () => {
  it("lists visibility rules with state badges", async () => {
    renderPage();
    expect(await screen.findByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("visible")).toBeInTheDocument();
    expect(screen.getByText("hidden")).toBeInTheDocument();
  });

  it("toggles a rule via PUT", async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText("Redis")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Show" }));
    const rule = policyMockControl
      .getState()
      .visibility.acme.find((r) => r.itemId === "redis");
    expect(rule?.visible).toBe(true);
    expect(await screen.findAllByText("visible")).not.toHaveLength(0);
  });

  it("hides mutations for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    expect(await screen.findByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
