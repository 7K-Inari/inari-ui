import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyPermissions } from "@/api/me";
import { MembersTab } from "@/pages/access/members-tab";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

let mockPermissions: MyPermissions = { canCreateOrganizations: false };

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: {} }),
}));
vi.mock("@/auth/permissions-context", () => ({
  usePermissions: () => mockPermissions,
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
  policyMockControl.reset();
  mockPermissions = {
    canCreateOrganizations: false,
    tenants: {
      acme: { canManageMembers: true, canManageTeams: true, canManageRbac: true },
    },
  };
});
afterAll(() => mockServer.close());

async function expandTeamMembers(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> {
  const card = (await screen.findByText("Platform Team")).closest(
    "[class*='rounded']",
  )! as HTMLElement;
  await user.click(within(card).getByRole("button", { name: "Members" }));
  return card;
}

describe("MembersTab", () => {
  it("lists org members with roles", async () => {
    render(<MembersTab />);
    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
    expect(screen.getByText("Dev Dorian")).toBeInTheDocument();
    expect(screen.getByLabelText("Role for Ada Admin")).toHaveValue("admin");
  });

  it("invites a new member by email", async () => {
    const user = userEvent.setup();
    render(<MembersTab />);
    await screen.findByText("Ada Admin");
    await user.type(screen.getByLabelText("Email"), "erin@acme.example");
    await user.selectOptions(
      screen.getByLabelText("Role", { selector: "#invite-role" }),
      "viewer",
    );
    await user.click(screen.getByRole("button", { name: "Invite" }));
    const added = policyMockControl
      .getState()
      .orgMembers.acme.find((m) => m.email === "erin@acme.example");
    expect(added?.roles).toEqual(["viewer"]);
  });

  it("changes and removes org member roles", async () => {
    const user = userEvent.setup();
    render(<MembersTab />);
    const row = (await screen.findByText("Dev Dorian")).closest("tr")!;
    await user.selectOptions(
      within(row).getByLabelText("Role for Dev Dorian"),
      "admin",
    );
    expect(
      policyMockControl.getState().orgMembers.acme.find((m) => m.userId === "u-dev")
        ?.roles,
    ).toEqual(["admin"]);

    await user.click(within(row).getByRole("button", { name: "Remove" }));
    expect(
      policyMockControl.getState().orgMembers.acme.map((m) => m.userId),
    ).not.toContain("u-dev");
  });

  it("adds a team member via the user picker (email search, no raw UUID input)", async () => {
    const user = userEvent.setup();
    render(<MembersTab />);
    const card = await expandTeamMembers(user);

    // Existing team member listed
    expect(await within(card).findByText("ada@acme.example")).toBeInTheDocument();

    const picker = within(card).getByLabelText("Add member");
    expect(picker).toHaveAttribute(
      "placeholder",
      expect.stringContaining("Search org members"),
    );

    await user.type(picker, "dorian@");
    const option = await within(card).findByRole("button", { name: /Dev Dorian/ });
    await user.click(option);

    expect(
      policyMockControl
        .getState()
        .teamMembers["acme/platform-team"].map((m) => m.userId),
    ).toContain("u-dev");
  });

  it("picker search filters out non-matching org members", async () => {
    const user = userEvent.setup();
    render(<MembersTab />);
    const card = await expandTeamMembers(user);
    await within(card).findByText("ada@acme.example");

    await user.type(within(card).getByLabelText("Add member"), "zzz-no-match");
    expect(
      await within(card).findByText("No matching org members"),
    ).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: /Dev Dorian/ }),
    ).not.toBeInTheDocument();
  });

  it("removes a team member", async () => {
    const user = userEvent.setup();
    render(<MembersTab />);
    const card = await expandTeamMembers(user);
    const item = (await within(card).findByText("ada@acme.example")).closest("li")!;
    await user.click(within(item).getByRole("button", { name: "Remove" }));
    expect(
      policyMockControl
        .getState()
        .teamMembers["acme/platform-team"]?.map((m) => m.userId) ?? [],
    ).not.toContain("u-admin");
  });

  it("creates a team", async () => {
    const user = userEvent.setup();
    render(<MembersTab />);
    await screen.findByText("Platform Team");
    await user.type(screen.getByLabelText("Name"), "data-eng");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(
      policyMockControl.getState().teams.acme.map((t) => t.name),
    ).toContain("data-eng");
  });

  it("disables mutations with tooltips when capabilities are absent", async () => {
    mockPermissions = {
      canCreateOrganizations: false,
      tenants: {
        acme: { canManageMembers: false, canManageTeams: false, canManageRbac: false },
      },
    };
    render(<MembersTab />);
    await screen.findByText("Ada Admin");

    expect(screen.getByLabelText("Role for Ada Admin")).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Name")).toBeDisabled();

    const inviteWrapper = screen
      .getByRole("button", { name: "Invite" })
      .closest("[aria-disabled]");
    expect(inviteWrapper).toHaveAttribute(
      "title",
      "Requires member management permission",
    );
    expect(screen.getByText("Read-only")).toBeInTheDocument();
  });
});
