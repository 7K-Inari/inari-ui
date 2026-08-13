import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantProvider, useTenant } from "@/tenant/tenant-context";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    parsedToken: {
      organization: { acme: { name: "Acme" }, globex: {} },
    },
  }),
}));

function Probe() {
  const { tenant, recents } = useTenant();
  return (
    <div>
      <span data-testid="tenant">{tenant}</span>
      <span data-testid="recents">{recents.join(",")}</span>
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
});
