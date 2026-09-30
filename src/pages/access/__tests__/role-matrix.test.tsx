import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyPermissions } from "@/api/me";
import { RoleMatrix } from "@/pages/access/role-matrix";
import { m3MockControl, setRbacMappingsMock } from "@/mocks/fixtures/m3";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

let mockPermissions: MyPermissions = { canCreateOrganizations: false };
let mockTenant = "acme";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: {} }),
}));
vi.mock("@/auth/permissions-context", () => ({
  usePermissions: () => mockPermissions,
}));
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m3MockControl.reset();
  policyMockControl.reset();
});
beforeEach(() => {
  m3MockControl.reset();
  policyMockControl.reset();
  mockTenant = "acme";
  mockPermissions = {
    canCreateOrganizations: false,
    tenants: {
      acme: { canManageRbac: true },
      globex: { canManageRbac: true },
    },
  };
});
afterAll(() => mockServer.close());

function renderMatrix() {
  return render(
    <MemoryRouter>
      <RoleMatrix />
    </MemoryRouter>,
  );
}

describe("RoleMatrix", () => {
  it("renders teams as rows with one role-entity select per row", async () => {
    renderMatrix();

    expect(await screen.findByText("Platform Team")).toBeInTheDocument();
    expect(screen.getByText("Developers")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();

    // Options come from the role entities (GET /roles), not the raw
    // ClusterRole read projection — every built-in is listed.
    const platformSelect = screen.getByLabelText("Role for Platform Team");
    for (const name of ["Admin", "Operator", "Editor", "Viewer"]) {
      expect(
        within(platformSelect).getByRole("option", { name }),
      ).toBeInTheDocument();
    }

    // Seed: platform-team→operator, developers→viewer, data→none. The
    // select value is the role entity id, not the ClusterRole name.
    expect(platformSelect).toHaveValue("role-operator");
    expect(screen.getByLabelText("Role for Developers")).toHaveValue(
      "role-viewer",
    );
    expect(screen.getByLabelText("Role for Data")).toHaveValue("");
  });

  it("lists custom roles as assignable options", async () => {
    policyMockControl.getState().roles.acme.push({
      id: "role-deployer",
      orgId: "t-acme",
      name: "deployer",
      displayName: "Deployer",
      description: "",
      builtin: false,
      permissions: ["tenant.read", "deployments.create"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    renderMatrix();
    const select = await screen.findByLabelText("Role for Platform Team");
    expect(
      within(select).getByRole("option", { name: "Deployer" }),
    ).toHaveValue("role-deployer");
  });

  it("links to the role management tab", async () => {
    renderMatrix();
    await screen.findByText("Platform Team");
    expect(
      screen.getByRole("link", { name: "Manage roles" }),
    ).toHaveAttribute("href", "/acme/access/roles");
  });

  it("saves the draft as one bulk PUT of team→roleId mappings", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    mockServer.use(
      http.put("*/api/v1/tenants/:org/rbac/mappings", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ changes: [] });
      }),
    );

    renderMatrix();
    await screen.findByText("Platform Team");

    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled(); // pristine

    await user.selectOptions(screen.getByLabelText("Role for Data"), "role-editor");
    expect(save).toBeEnabled();

    await user.click(save);
    expect(bodies).toHaveLength(1);
    const mappings = (bodies[0] as { mappings: { team: string; roleId: string }[] }).mappings;
    // exactly one mapping per team, "No role" teams omitted
    const teams = mappings.map((m) => m.team);
    expect(new Set(teams).size).toBe(teams.length);
    expect(mappings).toContainEqual({ team: "data", roleId: "role-editor" });
    expect(mappings).toContainEqual({
      team: "platform-team",
      roleId: "role-operator",
    });
    expect(mappings).toContainEqual({
      team: "developers",
      roleId: "role-viewer",
    });
  });

  it("clears a team's role via the No role option", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    mockServer.use(
      http.put("*/api/v1/tenants/:org/rbac/mappings", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ changes: [] });
      }),
    );

    renderMatrix();
    await screen.findByText("Platform Team");
    await user.selectOptions(
      screen.getByLabelText("Role for Developers"),
      "",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const mappings = (bodies[0] as { mappings: { team: string }[] }).mappings;
    expect(mappings.map((m) => m.team)).not.toContain("developers");
    expect(mappings).toHaveLength(1);
  });

  it("surfaces a server 409 (tenant.admin guardrail) as an error card and keeps the draft", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.put("*/api/v1/tenants/:org/rbac/mappings", () =>
        HttpResponse.json(
          {
            title: "Error",
            status: 409,
            detail: "at least one team must retain the tenant.admin permission",
          },
          { status: 409 },
        ),
      ),
    );

    renderMatrix();
    await screen.findByText("Platform Team");
    await user.selectOptions(
      screen.getByLabelText("Role for Platform Team"),
      "role-viewer",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText(/tenant\.admin permission/),
    ).toBeInTheDocument();
    // draft retained: still dirty, save stays enabled
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("drops a dirty draft when the tenant switches (no cross-tenant wipe)", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    mockServer.use(
      http.put("*/api/v1/tenants/:org/rbac/mappings", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ changes: [] });
      }),
    );

    const { rerender } = renderMatrix();
    await screen.findByText("Platform Team");
    await user.selectOptions(screen.getByLabelText("Role for Data"), "role-editor");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();

    // Tenant switch re-renders without unmounting (same route tree).
    mockTenant = "globex";
    rerender(
      <MemoryRouter>
        <RoleMatrix />
      </MemoryRouter>,
    );

    // The acme draft must not leak into globex: once the globex matrix and
    // roles load, the selects reflect the globex server state and Save is
    // disabled (pristine).
    await vi.waitFor(() =>
      expect(screen.getByLabelText("Role for Developers")).toHaveValue(
        "role-viewer",
      ),
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByLabelText("Role for Data")).toHaveValue("");
    expect(bodies).toHaveLength(0);
  });

  it("disables selects and Save with a tooltip when canManageRbac is false", async () => {
    mockPermissions = {
      canCreateOrganizations: false,
      tenants: { acme: { canManageRbac: false } },
    };
    renderMatrix();
    await screen.findByText("Platform Team");

    expect(screen.getByLabelText("Role for Platform Team")).toBeDisabled();
    const wrapper = screen
      .getByRole("button", { name: "Save changes" })
      .closest("[aria-disabled]");
    expect(wrapper).toHaveAttribute("aria-disabled", "true");
    expect(wrapper).toHaveAttribute("title", "Requires role management permission");
  });

  it("read-back after Save still resolves the assigned role", async () => {
    const user = userEvent.setup();
    renderMatrix();
    const select = await screen.findByLabelText("Role for Data");
    await user.selectOptions(select, "role-editor");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // After Save the matrix refetches; the row must still show the assigned
    // role, not degrade to "Unknown role" (the mock synthesizes ClusterRoles
    // from the role NAME, matching the server).
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled(),
    );
    expect(screen.getByLabelText("Role for Data")).toHaveValue("role-editor");
    expect(screen.queryByText(/Unknown role/)).not.toBeInTheDocument();
  });

  it("keeps an unresolvable ClusterRole visible and round-trips it on Save", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    mockServer.use(
      http.put("*/api/v1/tenants/:org/rbac/mappings", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ changes: [] });
      }),
    );
    // A mapping whose ClusterRole suffix matches no role entity (e.g. the
    // custom role was deleted elsewhere).
    m3MockControl.reset();
    setRbacMappingsMock("acme", [
      { groupPath: "tenant-acme/platform-team", clusterRole: "tenant-acme-operator" },
      { groupPath: "tenant-acme/developers", clusterRole: "tenant-acme-viewer" },
      { groupPath: "tenant-acme/data", clusterRole: "tenant-acme-ghost" },
    ]);

    renderMatrix();
    const select = await screen.findByLabelText("Role for Data");
    const unknown = within(select).getByRole("option", {
      name: "Unknown role (ghost)",
    }) as HTMLOptionElement;
    expect(unknown).toBeDisabled();
    expect(select).toHaveValue(unknown.value);

    // Saving another row must not drop the unknown mapping: the recovered
    // name round-trips as the roleId.
    await user.selectOptions(
      screen.getByLabelText("Role for Developers"),
      "role-editor",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const mappings = (bodies[0] as { mappings: { team: string; roleId: string }[] })
      .mappings;
    expect(mappings).toContainEqual({ team: "data", roleId: "ghost" });
    expect(mappings).toContainEqual({ team: "developers", roleId: "role-editor" });
  });
});
