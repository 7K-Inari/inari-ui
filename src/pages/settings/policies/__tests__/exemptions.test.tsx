import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ExemptionsPage } from "@/pages/settings/policies/exemptions";
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
    <MemoryRouter initialEntries={["/acme/settings/policies/exemptions"]}>
      <Routes>
        <Route
          path="/:tenant/settings/policies/exemptions"
          element={<ExemptionsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ExemptionsPage", () => {
  it("lists exemptions with state badges", async () => {
    renderPage();
    expect(await screen.findByText("pol-max-size")).toBeInTheDocument();
    expect(screen.getByText("pol-image-registry")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("requests a new exemption via the inline form", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("pol-max-size");
    await user.click(screen.getByRole("button", { name: "Request exemption" }));
    await user.type(screen.getByLabelText("Policy ID"), "pol-max-size");
    await user.type(screen.getByLabelText("Expires at"), "2030-01-01T00:00");
    await user.type(screen.getByLabelText("Reason"), "bulk import window");
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(await screen.findByText("bulk import window")).toBeInTheDocument();
  });

  it("approves a pending exemption", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("pol-max-size");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findAllByText("approved")).toHaveLength(2);
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
  });

  it("hides request and decision controls for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    await screen.findByText("pol-max-size");
    expect(
      screen.queryByRole("button", { name: "Request exemption" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
