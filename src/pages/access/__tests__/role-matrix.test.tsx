import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyPermissions } from "@/api/me";
import { RoleMatrix } from "@/pages/access/role-matrix";
import { m3MockControl } from "@/mocks/fixtures/m3";
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
});
beforeEach(() => {
  m3MockControl.reset();
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

describe("RoleMatrix", () => {
  it("renders teams as rows with friendly names and one role radio per row", async () => {
    render(<RoleMatrix />);

    expect(await screen.findByText("Platform Team")).toBeInTheDocument();
    expect(screen.getByText("Developers")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();

    // Friendly role names, not raw ClusterRole names / group paths.
    expect(screen.getByText("Operator")).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.queryByText(/tenant-acme\//)).not.toBeInTheDocument();

    // Seed: platform-team→operator, developers→viewer, data→none.
    expect(
      screen.getByRole("radio", { name: "Platform Team: Operator" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Developers: Viewer" }),
    ).toBeChecked();
    expect(screen.getByRole("radio", { name: "Data: No role" })).toBeChecked();

    // No checkboxes anywhere — radio semantics enforce one role per team.
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("saves the draft as one bulk PUT with one mapping per team", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    mockServer.use(
      http.put("*/api/v1/tenants/:org/rbac/mappings", async ({ request, params }) => {
        bodies.push(await request.json());
        // mirror the default handler semantics minimally for this test
        return HttpResponse.json({ changes: [], $org: params.org });
      }),
    );

    render(<RoleMatrix />);
    await screen.findByText("Platform Team");

    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled(); // pristine

    await user.click(screen.getByRole("radio", { name: "Data: Operator" }));
    expect(save).toBeEnabled();

    await user.click(save);
    expect(bodies).toHaveLength(1);
    const mappings = (bodies[0] as { mappings: { team: string; role: string }[] }).mappings;
    // exactly one mapping per team, "No role" teams omitted
    const teams = mappings.map((m) => m.team);
    expect(new Set(teams).size).toBe(teams.length);
    expect(mappings).toContainEqual({ team: "data", role: "tenant-acme-operator" });
    expect(mappings).toContainEqual({
      team: "platform-team",
      role: "tenant-acme-operator",
    });
    expect(mappings).toContainEqual({
      team: "developers",
      role: "tenant-acme-viewer",
    });
  });

  it("surfaces a server 400 (duplicate team) as an error card and keeps the draft", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.put("*/api/v1/tenants/:org/rbac/mappings", () =>
        HttpResponse.json(
          { title: "Error", status: 400, detail: 'duplicate mapping for team "data"' },
          { status: 400 },
        ),
      ),
    );

    render(<RoleMatrix />);
    await screen.findByText("Platform Team");
    await user.click(screen.getByRole("radio", { name: "Data: Viewer" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText(/duplicate mapping for team "data"/),
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

    const { rerender } = render(<RoleMatrix />);
    await screen.findByText("Platform Team");
    await user.click(screen.getByRole("radio", { name: "Data: Operator" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();

    // Tenant switch re-renders without unmounting (same route tree).
    mockTenant = "globex";
    rerender(<RoleMatrix />);

    // The acme draft must not leak into globex: the matrix reflects the
    // globex server state and Save is disabled (pristine).
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled(),
    );
    expect(
      screen.getByRole("radio", { name: "Developers: Viewer" }),
    ).toBeChecked();
    expect(screen.getByRole("radio", { name: "Data: No role" })).toBeChecked();
    expect(bodies).toHaveLength(0);
  });

  it("disables radios and Save with a tooltip when canManageRbac is false", async () => {
    mockPermissions = {
      canCreateOrganizations: false,
      tenants: { acme: { canManageRbac: false } },
    };
    render(<RoleMatrix />);
    await screen.findByText("Platform Team");

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
    const wrapper = screen
      .getByRole("button", { name: "Save changes" })
      .closest("[aria-disabled]");
    expect(wrapper).toHaveAttribute("aria-disabled", "true");
    expect(wrapper).toHaveAttribute("title", "Requires role management permission");
  });
});
