import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RegistrationTokensPage } from "@/pages/settings/tokens/registration-tokens";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

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
    <MemoryRouter initialEntries={["/acme/settings/tokens/registration"]}>
      <Routes>
        <Route
          path="/:tenant/settings/tokens/registration"
          element={<RegistrationTokensPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RegistrationTokensPage", () => {
  it("shows a cluster picker and empty token list", async () => {
    renderPage();
    expect(await screen.findByLabelText("Cluster")).toBeInTheDocument();
    expect(
      await screen.findByText("No registration tokens issued for this cluster."),
    ).toBeInTheDocument();
  });

  it("issues a token and shows the one-time display dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText("Cluster");
    await user.click(screen.getByRole("button", { name: "Issue token" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Registration token issued",
    });
    expect(within(dialog).getByText(/inari-reg-kind-dev-token/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(
      screen.queryByRole("dialog", { name: "Registration token issued" }),
    ).not.toBeInTheDocument();
    expect(policyMockControl.getState().registrationTokens["cl-kind-dev"]).toHaveLength(1);
    expect(await screen.findByText("active")).toBeInTheDocument();
  });

  it("revokes an active token", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText("Cluster");
    await user.click(screen.getByRole("button", { name: "Issue token" }));
    await screen.findByRole("dialog", { name: "Registration token issued" });
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    expect(policyMockControl.getState().registrationTokens["cl-kind-dev"]).toHaveLength(0);
    expect(
      await screen.findByText("No registration tokens issued for this cluster."),
    ).toBeInTheDocument();
  });

  it("hides mutations for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    expect(await screen.findByLabelText("Cluster")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Issue token" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
