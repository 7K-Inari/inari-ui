import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MembersPage } from "@/pages/settings/org/members";
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
    <MemoryRouter initialEntries={["/acme/settings/org/members"]}>
      <Routes>
        <Route path="/:tenant/settings/org/members" element={<MembersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MembersPage", () => {
  it("lists org members with roles", async () => {
    renderPage();
    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
    expect(screen.getByText("Dev Dorian")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Role for Ada Admin"),
    ).toHaveValue("admin");
  });

  it("invites a new member via PUT", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ada Admin");
    await user.type(screen.getByLabelText("Email"), "erin@acme.example");
    await user.type(screen.getByLabelText("Display name"), "Erin Engineer");
    await user.selectOptions(screen.getByLabelText("Role"), "viewer");
    await user.click(screen.getByRole("button", { name: "Invite" }));
    expect(await screen.findByText("erin@acme.example")).toBeInTheDocument();
    const added = policyMockControl
      .getState()
      .orgMembers.acme.find((m) => m.email === "erin@acme.example");
    expect(added?.role).toBe("viewer");
  });

  it("changes a member role via PUT", async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText("Dev Dorian")).closest("tr")!;
    await user.selectOptions(
      within(row).getByLabelText("Role for Dev Dorian"),
      "admin",
    );
    const updated = policyMockControl
      .getState()
      .orgMembers.acme.find((m) => m.userId === "u-dev");
    expect(updated?.role).toBe("admin");
  });

  it("removes a member", async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText("Dev Dorian")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
    expect(screen.queryByText("Dev Dorian")).not.toBeInTheDocument();
    expect(
      policyMockControl.getState().orgMembers.acme.map((m) => m.userId),
    ).not.toContain("u-dev");
  });

  it("hides mutations for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
