import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyPermissions } from "@/api/me";
import { AccessPage } from "@/pages/access/access-page";
import { m3MockControl } from "@/mocks/fixtures/m3";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

const mockPermissions: MyPermissions = {
  canCreateOrganizations: false,
  tenants: {
    acme: { canManageMembers: true, canManageTeams: true, canManageRbac: true },
  },
};

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
  m3MockControl.reset();
  policyMockControl.reset();
});
beforeEach(() => {
  m3MockControl.reset();
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:tenant/access" element={<AccessPage />} />
        <Route path="/:tenant/access/:tab" element={<AccessPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccessPage", () => {
  it("renders the tabs and defaults to Members", async () => {
    renderPage("/acme/access");
    expect(
      screen.getByRole("link", { name: "Members" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Teams & Roles" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Identity" })).toBeInTheDocument();
    // Members tab content loads
    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
  });

  it("shows the role editor on the Roles tab", async () => {
    renderPage("/acme/access/roles");
    expect(screen.getByRole("link", { name: "Roles" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText("Admin")).toBeInTheDocument();
    expect(screen.getAllByText("Built-in")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "New role" })).toBeInTheDocument();
  });

  it("shows the role matrix on the Teams & Roles tab", async () => {
    renderPage("/acme/access/teams");
    expect(screen.getByRole("link", { name: "Teams & Roles" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText("Platform Team")).toBeInTheDocument();
    expect(screen.getByLabelText("Role for Platform Team")).toHaveValue(
      "role-operator",
    );
  });

  it("shows identity settings links on the Identity tab", async () => {
    renderPage("/acme/access/identity");
    const clients = await screen.findByRole("link", { name: /OIDC Clients/ });
    expect(clients).toHaveAttribute("href", "/acme/settings/identity/clients");
    expect(
      screen.getByRole("link", { name: /Scopes/ }),
    ).toHaveAttribute("href", "/acme/settings/identity/scopes");
  });

  it("navigates between tabs via the tab links", async () => {
    const user = userEvent.setup();
    renderPage("/acme/access/members");
    await screen.findByText("Ada Admin");
    await user.click(screen.getByRole("link", { name: "Teams & Roles" }));
    expect(await screen.findByText("Platform Team")).toBeInTheDocument();
  });
});
