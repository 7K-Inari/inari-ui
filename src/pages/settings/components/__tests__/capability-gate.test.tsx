import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MyPermissions } from "@/api/me";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";

let mockPermissions: MyPermissions = { canCreateOrganizations: false };
let mockParsedToken: Record<string, unknown> | undefined = {};

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: mockParsedToken }),
}));
vi.mock("@/auth/permissions-context", () => ({
  usePermissions: () => mockPermissions,
}));
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

function CapabilitiesProbe() {
  const caps = useOrgCapabilities();
  return (
    <output data-testid="caps">{JSON.stringify(caps)}</output>
  );
}

beforeEach(() => {
  mockPermissions = { canCreateOrganizations: false };
  mockParsedToken = {};
});

describe("useOrgCapabilities", () => {
  it("uses per-capability flags from the tenants projection when present", () => {
    mockPermissions = {
      canCreateOrganizations: false,
      tenants: {
        acme: { canManageMembers: true, canManageTeams: false, canManageRbac: false },
      },
    };
    render(<CapabilitiesProbe />);
    const caps = JSON.parse(screen.getByTestId("caps").textContent!);
    expect(caps).toMatchObject({
      isAdmin: false,
      canManageMembers: true,
      canManageTeams: false,
      canManageRbac: false,
    });
  });

  it("falls back to admin-derived defaults when the projection is absent", () => {
    mockPermissions = {
      canCreateOrganizations: false,
      orgRoles: { acme: "org-admin" },
    };
    render(<CapabilitiesProbe />);
    const caps = JSON.parse(screen.getByTestId("caps").textContent!);
    expect(caps).toMatchObject({
      isAdmin: true,
      canManageMembers: true,
      canManageTeams: true,
      canManageRbac: true,
    });
  });

  it("falls back to the token organization claim without server roles", () => {
    mockParsedToken = { organization: { acme: { roles: ["admin"] } } };
    render(<CapabilitiesProbe />);
    const caps = JSON.parse(screen.getByTestId("caps").textContent!);
    expect(caps.isAdmin).toBe(true);
    expect(caps.canManageRbac).toBe(true);
  });

  it("treats an absent projection as unknown, not denial, for admins only", () => {
    render(<CapabilitiesProbe />);
    const caps = JSON.parse(screen.getByTestId("caps").textContent!);
    expect(caps).toMatchObject({
      isAdmin: false,
      canManageMembers: false,
      canManageTeams: false,
      canManageRbac: false,
    });
  });
});

describe("CapabilityGate", () => {
  it("renders children when the capability is granted", () => {
    mockPermissions = {
      canCreateOrganizations: false,
      tenants: { acme: { canManageRbac: true } },
    };
    render(
      <CapabilityGate capability="manageRbac">
        <button>Save</button>
      </CapabilityGate>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("hides children by default when the capability is missing", () => {
    render(
      <CapabilityGate capability="manageRbac" fallback={<span>no access</span>}>
        <button>Save</button>
      </CapabilityGate>,
    );
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText("no access")).toBeInTheDocument();
  });

  it("mode=disable renders children inert with a tooltip instead of unmounting", () => {
    render(
      <CapabilityGate capability="manageRbac" mode="disable">
        <button>Save</button>
      </CapabilityGate>,
    );
    const wrapper = screen.getByRole("button", { name: "Save" }).closest("[aria-disabled]");
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveAttribute("aria-disabled", "true");
    expect(wrapper).toHaveAttribute("title", "Requires role management permission");
  });

  it("mode=disable accepts a custom reason", () => {
    render(
      <CapabilityGate capability="admin" mode="disable" disabledReason="Org admins only">
        <button>Delete</button>
      </CapabilityGate>,
    );
    const wrapper = screen.getByRole("button", { name: "Delete" }).closest("[aria-disabled]");
    expect(wrapper).toHaveAttribute("title", "Org admins only");
  });
});
