import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TeamsPage } from "@/pages/settings/org/teams";
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
    <MemoryRouter initialEntries={["/acme/settings/org/teams"]}>
      <Routes>
        <Route path="/:tenant/settings/org/teams" element={<TeamsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TeamsPage", () => {
  it("lists teams and expands members", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("platform-team")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Members" }));
    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
  });

  it("creates a team via POST", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("platform-team");
    await user.type(screen.getByLabelText("Name"), "app-team");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("app-team")).toBeInTheDocument();
    expect(
      policyMockControl.getState().teams.acme.map((t) => t.name),
    ).toContain("app-team");
  });

  it("deletes a team", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("platform-team");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.queryByText("platform-team")).not.toBeInTheDocument();
    expect(policyMockControl.getState().teams.acme).toHaveLength(0);
  });

  it("adds and removes a team member", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("platform-team");
    await user.click(screen.getByRole("button", { name: "Members" }));
    const input = await screen.findByLabelText("User ID");
    await user.type(input, "u-dev");
    await user.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByText("Dev Dorian")).toBeInTheDocument();
    const removeButtons = await screen.findAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[0]);
    expect(policyMockControl.getState().teamMembers["acme/platform-team"]).toHaveLength(1);
  });

  it("hides mutations for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    expect(await screen.findByText("platform-team")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
