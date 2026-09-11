import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { m3MockControl } from "@/mocks/fixtures/m3";
import { mockServer } from "@/mocks/server";
import { RbacMappingSettingsPage } from "@/pages/settings/identity/rbac-mapping";

let mockParsedToken: Record<string, unknown> | undefined = {
  organization: { acme: { name: "Acme", roles: ["admin"] } },
};
vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: mockParsedToken }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m3MockControl.reset();
});
beforeEach(() => {
  mockParsedToken = { organization: { acme: { name: "Acme", roles: ["admin"] } } };
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/acme/settings/identity/rbac"]}>
      <Routes>
        <Route
          path="/:tenant/settings/identity/rbac"
          element={<RbacMappingSettingsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RbacMappingSettingsPage", () => {
  it("renders the matrix and links to the operational rbac page", async () => {
    renderPage();
    expect(await screen.findByText("tenant-acme/platform-team")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /RBAC matrix/ });
    expect(link).toHaveAttribute("href", "/acme/rbac");
  });

  it("saves the whole mapping set with one bulk PUT", async () => {
    const bodies: unknown[] = [];
    mockServer.use(
      http.put("*/api/v1/tenants/acme/rbac/mappings", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("tenant-acme/data");
    const cell = screen.getByRole("checkbox", {
      name: "Map tenant-acme/data to tenant-acme-viewer",
    });
    await user.click(cell);
    await user.click(screen.getByRole("button", { name: "Save mappings" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    const body = bodies[0] as { mappings: { groupPath: string; clusterRole: string }[] };
    expect(Array.isArray(body.mappings)).toBe(true);
    expect(body.mappings).toContainEqual({
      groupPath: "tenant-acme/data",
      clusterRole: "tenant-acme-viewer",
    });
  });

  it("hides save for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    await screen.findByText("tenant-acme/data");
    expect(screen.queryByRole("button", { name: "Save mappings" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
