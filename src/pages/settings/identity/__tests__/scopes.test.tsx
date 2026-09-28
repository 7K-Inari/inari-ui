import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";
import { OidcScopesPage } from "@/pages/settings/identity/scopes";

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
  policyMockControl.reset();
});
beforeEach(() => {
  mockParsedToken = { organization: { acme: { name: "Acme", roles: ["admin"] } } };
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/acme/settings/identity/scopes"]}>
      <Routes>
        <Route path="/:tenant/settings/identity/scopes" element={<OidcScopesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OidcScopesPage", () => {
  it("renders the scopes catalog and client assignments", async () => {
    renderPage();
    expect((await screen.findAllByText("inari-catalog")).length).toBeGreaterThan(0);
    expect(screen.getByText("read, deploy")).toBeInTheDocument();
    expect(screen.getByText("ci-deployer")).toBeInTheDocument();
  });

  it("assigns scopes to a client via a single PUT", async () => {
    let putBody: { scopes?: string[] } | null = null;
    mockServer.use(
      http.put("*/api/v1/tenants/acme/identity/clients/:id/scopes", async ({ request }) => {
        putBody = (await request.json()) as { scopes?: string[] };
        return HttpResponse.json({
          client: {
            clientId: "org-acme-inari-cli",
            name: "inari-cli",
            type: "public",
            audiences: ["inari-server"],
            redirectUris: [],
            scopes: putBody.scopes ?? [],
            status: "active",
            createdAt: new Date().toISOString(),
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("inari-cli");
    await user.click(screen.getAllByRole("button", { name: "Assign scopes" })[0]);
    await user.click(screen.getByRole("checkbox", { name: "inari-catalog:deploy" }));
    await user.click(screen.getByRole("button", { name: "Save scopes" }));
    expect(putBody).toEqual({ scopes: ["inari-server:read", "inari-catalog:read", "inari-catalog:deploy"] });
  });
});
