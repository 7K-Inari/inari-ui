import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SettingsLayout } from "@/pages/settings/settings-layout";

let mockParsedToken: Record<string, unknown> | undefined = {};
vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: mockParsedToken }),
}));

let mockTenant = "acme";
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

function renderLayout(initialPath = "/acme/settings/org/git") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/:tenant/settings" element={<SettingsLayout />}>
          <Route path="org/git" element={<div>Git page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("SettingsLayout", () => {
  it("renders the sub-nav sections and the active leaf outlet", async () => {
    renderLayout();
    expect(
      screen.getByRole("navigation", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Git" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Packs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exemptions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compliance" })).toBeInTheDocument();
    expect(await screen.findByText("Git page")).toBeInTheDocument();
  });

  it("hides admin-only nav entries for a viewer", () => {
    mockParsedToken = {};
    renderLayout();
    expect(screen.queryByRole("link", { name: "OIDC Clients" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "IdP Brokering" })).not.toBeInTheDocument();
    expect(screen.queryByText("Identity")).not.toBeInTheDocument();
  });

  it("shows admin-only nav entries for an org admin", () => {
    mockParsedToken = { organization: { acme: { name: "Acme", roles: ["admin"] } } };
    renderLayout();
    expect(screen.getByRole("link", { name: "OIDC Clients" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IdP Brokering" })).toBeInTheDocument();
  });

  it("asks for a tenant selection in the all-tenants view", () => {
    mockTenant = "all";
    render(
      <MemoryRouter initialEntries={["/all/settings"]}>
        <Routes>
          <Route path="/:tenant/settings" element={<SettingsLayout />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/select a specific tenant/i)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Settings" })).not.toBeInTheDocument();
  });
});
