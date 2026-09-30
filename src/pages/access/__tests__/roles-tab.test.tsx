import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyPermissions } from "@/api/me";
import { RolesTab } from "@/pages/access/roles-tab";
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
    tenants: { acme: { canManageRbac: true } },
  };
});
afterAll(() => mockServer.close());

describe("RolesTab", () => {
  it("lists built-in roles; built-ins have no delete action", async () => {
    render(<RolesTab />);
    expect(await screen.findByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();
    expect(screen.getAllByText("Built-in")).toHaveLength(4);
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("creates a custom role with selected permissions", async () => {
    const user = userEvent.setup();
    render(<RolesTab />);
    await screen.findByText("Admin");

    await user.click(screen.getByRole("button", { name: "New role" }));
    await user.type(screen.getByLabelText("Name"), "deployer");
    await user.type(screen.getByLabelText("Display name"), "Deployer");
    await user.click(
      screen.getByRole("checkbox", { name: /Read organization/ }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Create deployments/ }),
    );
    await user.click(screen.getByRole("button", { name: "Create" }));

    const roles = policyMockControl.getState().roles.acme;
    const created = roles.find((r) => r.name === "deployer");
    expect(created?.builtin).toBe(false);
    expect(created?.permissions).toEqual(
      expect.arrayContaining(["tenant.read", "deployments.create"]),
    );
    // The new role appears in the table with a delete action.
    expect(await screen.findByText("Deployer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("edits a built-in bundle with the name locked", async () => {
    const user = userEvent.setup();
    render(<RolesTab />);
    const row = (await screen.findByText("Viewer")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Edit" }));

    const name = screen.getByLabelText("Name");
    expect(name).toBeDisabled();
    expect(name).toHaveValue("viewer");

    await user.click(
      screen.getByRole("checkbox", { name: /Invoke extensions/ }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    const viewer = policyMockControl
      .getState()
      .roles.acme.find((r) => r.name === "viewer")!;
    expect(viewer.permissions).toContain("extensions.invoke");
  });

  it("deletes a custom role", async () => {
    const user = userEvent.setup();
    policyMockControl.getState().roles.acme.push({
      id: "role-temp",
      orgId: "t-acme",
      name: "temp",
      displayName: "Temp",
      description: "",
      builtin: false,
      permissions: ["tenant.read"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    render(<RolesTab />);
    const row = (await screen.findByText("Temp")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    expect(
      policyMockControl.getState().roles.acme.map((r) => r.name),
    ).not.toContain("temp");
  });

  it("surfaces the server 409 when deleting a team-bound role", async () => {
    const user = userEvent.setup();
    policyMockControl.getState().roles.acme.push({
      id: "role-bound",
      orgId: "t-acme",
      name: "bound",
      displayName: "Bound",
      description: "",
      builtin: false,
      permissions: ["tenant.read"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const team = policyMockControl
      .getState()
      .teams.acme.find((t) => t.name === "platform-team")!;
    team.roleId = "role-bound";

    render(<RolesTab />);
    const row = (await screen.findByText("Bound")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText(/remap them first/),
    ).toBeInTheDocument();
    expect(
      policyMockControl.getState().roles.acme.map((r) => r.name),
    ).toContain("bound");
  });

  it("marks the tab read-only when canManageRbac is false", async () => {
    mockPermissions = {
      canCreateOrganizations: false,
      tenants: { acme: { canManageRbac: false } },
    };
    render(<RolesTab />);
    await screen.findByText("Admin");
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    const wrapper = screen
      .getByRole("button", { name: "New role" })
      .closest("[aria-disabled]");
    expect(wrapper).toHaveAttribute("aria-disabled", "true");
  });
});
