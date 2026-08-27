import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const kcMocks = vi.hoisted(() => ({
  switchOrganization: vi.fn<(alias: string) => boolean>(() => true),
  consumePendingOrg: vi.fn<() => string | null>(() => null),
}));

vi.mock("@/auth/keycloak", () => ({
  switchOrganization: kcMocks.switchOrganization,
  consumePendingOrg: kcMocks.consumePendingOrg,
}));

const authState = vi.hoisted(() => ({
  parsedToken: {
    organization: { acme: { name: "Acme" }, globex: {} },
  } as Record<string, unknown> | undefined,
}));

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ parsedToken: authState.parsedToken }),
}));

import { TenantProvider, useTenant } from "@/tenant/tenant-context";

function Probe() {
  const { tenant, orgs, recents, setTenant } = useTenant();
  const { pathname } = useLocation();
  return (
    <div>
      <span data-testid="tenant">{tenant}</span>
      <span data-testid="orgs">{orgs.map((o) => o.id).join(",")}</span>
      <span data-testid="recents">{recents.join(",")}</span>
      <span data-testid="path">{pathname}</span>
      <button onClick={() => setTenant("globex")}>switch-globex</button>
      <button onClick={() => setTenant("all")}>switch-all</button>
    </div>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/:tenant/*"
          element={
            <TenantProvider>
              <Probe />
            </TenantProvider>
          }
        />
        <Route path="/all/overview" element={<div>all-home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TenantProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    kcMocks.switchOrganization.mockClear().mockReturnValue(true);
    kcMocks.consumePendingOrg.mockClear().mockReturnValue(null);
    authState.parsedToken = {
      organization: { acme: { name: "Acme" }, globex: {} },
    };
  });

  it("resolves the tenant from the URL param", () => {
    renderAt("/acme/overview");
    expect(screen.getByTestId("tenant")).toHaveTextContent("acme");
  });

  it("redirects to all-tenants home for an unknown org", async () => {
    renderAt("/evilcorp/overview");
    expect(await screen.findByText("all-home")).toBeInTheDocument();
  });

  it("records visited orgs as recents, most recent first, deduplicated", async () => {
    const { unmount } = renderAt("/acme/overview");
    unmount();
    renderAt("/globex/overview");
    expect(screen.getByTestId("recents")).toHaveTextContent("globex,acme");
  });

  it("triggers silent re-authentication when switching to another org", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderAt("/acme/overview");
    await user.click(screen.getByText("switch-globex"));
    expect(kcMocks.switchOrganization).toHaveBeenCalledWith("globex");
    expect(screen.getByTestId("path")).toHaveTextContent("/acme/overview");
  });

  it("navigates without re-auth when switching to all tenants", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderAt("/acme/overview");
    await user.click(screen.getByText("switch-all"));
    expect(kcMocks.switchOrganization).not.toHaveBeenCalled();
    expect(await screen.findByText("all-home")).toBeInTheDocument();
  });

  it("falls back to navigation when the org is not in the token", async () => {
    kcMocks.switchOrganization.mockReturnValue(false);
    const user = (await import("@testing-library/user-event")).default.setup();
    renderAt("/acme/overview");
    await user.click(screen.getByText("switch-globex"));
    expect(kcMocks.switchOrganization).toHaveBeenCalledWith("globex");
    expect(screen.getByTestId("path")).toHaveTextContent("/globex/overview");
  });

  it("navigates to the pending org after a re-authentication redirect", () => {
    kcMocks.consumePendingOrg.mockReturnValue("globex");
    renderAt("/acme/overview");
    expect(screen.getByTestId("path")).toHaveTextContent("/globex/overview");
  });

  it("keeps the full org list available when the token is scoped to one org", () => {
    sessionStorage.setItem(
      "inari-orgs",
      JSON.stringify([
        { id: "acme", name: "Acme" },
        { id: "globex", name: "Globex" },
      ]),
    );
    authState.parsedToken = { organization: { globex: { name: "Globex" } } };
    renderAt("/globex/overview");
    expect(screen.getByTestId("orgs")).toHaveTextContent("globex,acme");
  });

  it("caches the full org list for later org-scoped sessions", () => {
    renderAt("/acme/overview");
    expect(JSON.parse(sessionStorage.getItem("inari-orgs") ?? "[]")).toEqual([
      { id: "acme", name: "Acme" },
      { id: "globex", name: "globex" },
    ]);
  });
});
