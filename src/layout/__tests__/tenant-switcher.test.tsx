import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PermissionsProvider } from "@/auth/permissions-context";
import { TenantSwitcher } from "@/layout/tenant-switcher";
import { mockServer } from "@/mocks/server";
import { TenantProvider } from "@/tenant/tenant-context";

const kcMocks = vi.hoisted(() => ({
  switchOrganization: vi.fn<(alias: string) => boolean>(() => true),
  consumePendingOrg: vi.fn<() => string | null>(() => null),
}));

vi.mock("@/auth/keycloak", () => ({
  switchOrganization: kcMocks.switchOrganization,
  consumePendingOrg: kcMocks.consumePendingOrg,
}));

let mockParsedToken: Record<string, unknown> | undefined;
vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", authenticated: true, parsedToken: mockParsedToken }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

function allowOrgCreation(canCreateOrganizations: boolean) {
  mockServer.use(
    http.get("*/api/v1/me/permissions", () =>
      HttpResponse.json({ canCreateOrganizations }),
    ),
  );
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="path">{pathname}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/create-organization" element={<LocationProbe />} />
        <Route
          path="/:tenant/*"
          element={
            <PermissionsProvider>
              <TenantProvider>
                <TenantSwitcher />
                <LocationProbe />
              </TenantProvider>
            </PermissionsProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TenantSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    kcMocks.switchOrganization.mockClear().mockReturnValue(true);
    kcMocks.consumePendingOrg.mockClear().mockReturnValue(null);
    mockParsedToken = {
      organization: { acme: { name: "Acme" }, globex: { name: "Globex" } },
    };
  });

  it("lists the user's organizations and re-authenticates on select", async () => {
    const user = userEvent.setup();
    renderAt("/all/overview");
    await user.click(screen.getByRole("button", { name: /tenant context/i }));
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    await user.click(screen.getByText("Globex"));
    expect(kcMocks.switchOrganization).toHaveBeenCalledWith("globex");
  });

  it("shows the active org name in the trigger", () => {
    renderAt("/acme/overview");
    expect(
      screen.getByRole("button", { name: /tenant context/i }),
    ).toHaveTextContent("Acme");
  });

  it("offers team scope only inside an org", async () => {
    const user = userEvent.setup();
    renderAt("/acme/overview");
    await user.click(screen.getByRole("button", { name: /tenant context/i }));
    expect(screen.getByText("Team scope")).toBeInTheDocument();
  });

  it("hides the create organization CTA when the endpoint denies it", async () => {
    allowOrgCreation(false);
    const user = userEvent.setup();
    renderAt("/all/overview");
    await user.click(screen.getByRole("button", { name: /tenant context/i }));
    expect(screen.getByText("Acme")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Create organization")).not.toBeInTheDocument();
  });

  it("hides the create organization CTA when the permissions fetch fails", async () => {
    mockServer.use(
      http.get("*/api/v1/me/permissions", () =>
        HttpResponse.json({ title: "Error", status: 500, detail: "boom" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderAt("/all/overview");
    await user.click(screen.getByRole("button", { name: /tenant context/i }));
    expect(screen.getByText("Acme")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Create organization")).not.toBeInTheDocument();
  });

  it("shows the create organization CTA when the endpoint allows it and navigates", async () => {
    allowOrgCreation(true);
    mockParsedToken = { organization: { acme: { name: "Acme" } } };
    const user = userEvent.setup();
    renderAt("/all/overview");
    await user.click(screen.getByRole("button", { name: /tenant context/i }));
    await user.click(await screen.findByText("Create organization"));
    expect(await screen.findByTestId("path")).toHaveTextContent(
      "/create-organization",
    );
  });
});
