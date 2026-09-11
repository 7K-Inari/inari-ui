import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";
import { OidcClientsPage } from "@/pages/settings/identity/clients";

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
    <MemoryRouter initialEntries={["/acme/settings/identity/clients"]}>
      <Routes>
        <Route path="/:tenant/settings/identity/clients" element={<OidcClientsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OidcClientsPage", () => {
  it("lists OIDC clients", async () => {
    renderPage();
    expect(await screen.findByText("inari-cli")).toBeInTheDocument();
    expect(screen.getByText("ci-deployer")).toBeInTheDocument();
  });

  it("creates a confidential client and shows the one-time secret", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("inari-cli");
    await user.click(screen.getByRole("button", { name: "New client" }));
    await user.type(screen.getByLabelText(/Name/), "agent-east");
    await user.click(screen.getByRole("button", { name: "Create client" }));
    expect(await screen.findByRole("dialog", { name: "Client secret" })).toBeInTheDocument();
    expect(screen.getByText(/sec-oc-gen\d+-onetime/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText("agent-east")).toBeInTheDocument();
  });

  it("rotates a secret and shows the new one-time secret", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ci-deployer");
    await user.click(screen.getByRole("button", { name: "Rotate secret" }));
    expect(await screen.findByRole("dialog", { name: "Client secret" })).toBeInTheDocument();
    expect(screen.getByText("sec-oc-ci-rotated")).toBeInTheDocument();
  });

  it("hides write controls for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    await screen.findByText("inari-cli");
    expect(screen.queryByRole("button", { name: "New client" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
