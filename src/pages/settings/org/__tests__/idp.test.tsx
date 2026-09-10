import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { policyMockControl, putIdpProviderMock } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";
import { IdpBrokeringPage } from "@/pages/settings/org/idp";

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
    <MemoryRouter initialEntries={["/acme/settings/org/idp"]}>
      <Routes>
        <Route path="/:tenant/settings/org/idp" element={<IdpBrokeringPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function seedProvider() {
  putIdpProviderMock("acme", {
    provider: "oidc",
    alias: "acme-sso",
    issuerUrl: "https://idp.acme.example",
    clientId: "inari-acme",
    clientSecret: "sec-initial",
    claimMapping: { email: "email", groups: "groups" },
    domainHints: ["acme.example"],
  });
}

describe("IdpBrokeringPage", () => {
  it("shows an empty state with a configure CTA when no provider exists", async () => {
    renderPage();
    expect(await screen.findByText(/no SSO provider configured/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure provider" })).toBeInTheDocument();
  });

  it("creates a provider with a write-only secret", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(screen.getByRole("button", { name: "Configure provider" }));
    await user.type(screen.getByLabelText(/Alias/), "acme-sso");
    await user.type(screen.getByLabelText(/Issuer URL/), "https://idp.acme.example");
    await user.type(screen.getByLabelText(/Client ID/), "inari-acme");
    await user.type(screen.getByLabelText(/Client secret/), "sec-new");
    await user.click(screen.getByRole("button", { name: "Save provider" }));
    expect(await screen.findByText("acme-sso")).toBeInTheDocument();
    expect(screen.getByText("https://idp.acme.example")).toBeInTheDocument();
    // Secret is never displayed back — only the configured state.
    expect(screen.getByText(/secret configured/i)).toBeInTheDocument();
    expect(screen.queryByText("sec-new")).not.toBeInTheDocument();
  });

  it("shows the configured provider without exposing the secret", async () => {
    seedProvider();
    renderPage();
    expect(await screen.findByText("acme-sso")).toBeInTheDocument();
    expect(screen.getByText(/secret configured/i)).toBeInTheDocument();
    expect(screen.queryByText("sec-initial")).not.toBeInTheDocument();
    expect(screen.getByText("acme.example")).toBeInTheDocument();
    // One IdP per org: no "add another" affordance once configured.
    expect(screen.queryByRole("button", { name: "Configure provider" })).not.toBeInTheDocument();
  });

  it("edits a provider without a secret field", async () => {
    seedProvider();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-sso");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByLabelText(/Client secret/)).not.toBeInTheDocument();
    const alias = screen.getByLabelText(/Alias/);
    await user.clear(alias);
    await user.type(alias, "acme-entra");
    await user.click(screen.getByRole("button", { name: "Save provider" }));
    expect(await screen.findByText("acme-entra")).toBeInTheDocument();
  });

  it("rotates the client secret after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedProvider();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-sso");
    await user.click(screen.getByRole("button", { name: "Rotate secret" }));
    await user.type(await screen.findByLabelText(/New client secret/), "sec-rotated");
    await user.click(screen.getByRole("button", { name: "Rotate" }));
    expect(await screen.findByText(/secret rotated/i)).toBeInTheDocument();
    expect(screen.queryByText("sec-rotated")).not.toBeInTheDocument();
  });

  it("deletes the provider after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedProvider();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-sso");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/no SSO provider configured/i)).toBeInTheDocument();
  });

  it("hides write controls for an org viewer", async () => {
    mockParsedToken = {};
    seedProvider();
    renderPage();
    await screen.findByText("acme-sso");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rotate secret" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
