import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantSwitcher } from "@/layout/tenant-switcher";
import { TenantProvider } from "@/tenant/tenant-context";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    parsedToken: {
      organization: { acme: { name: "Acme" }, globex: { name: "Globex" } },
    },
  }),
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="path">{pathname}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/:tenant/*"
          element={
            <TenantProvider>
              <TenantSwitcher />
              <LocationProbe />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TenantSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lists the user's organizations and navigates on select", async () => {
    const user = userEvent.setup();
    renderAt("/all/overview");
    await user.click(screen.getByRole("button", { name: /tenant context/i }));
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    await user.click(screen.getByText("Globex"));
    expect(await screen.findByTestId("path")).toHaveTextContent(
      "/globex/overview",
    );
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
});
