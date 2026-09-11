import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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
  mockParsedToken = {
    organization: { acme: { name: "Acme", roles: ["admin"] } },
  };
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/acme/settings/org/idp"]}>
      <Routes>
        <Route
          path="/:tenant/settings/org/idp"
          element={<IdpBrokeringPage />}
        />
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
    expect(
      await screen.findByText(/no SSO provider configured/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configure provider" }),
    ).toBeInTheDocument();
  });

  it("creates a provider with a write-only secret", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(
      screen.getByRole("button", { name: "Configure provider" }),
    );
    await user.type(screen.getByLabelText(/Alias/), "acme-sso");
    await user.type(
      screen.getByLabelText(/Issuer URL/),
      "https://idp.acme.example",
    );
    await user.type(screen.getByLabelText(/Client ID/), "inari-acme");
    await user.type(screen.getByLabelText(/Client secret/), "sec-new");
    await user.click(screen.getByRole("button", { name: "Save provider" }));
    expect(await screen.findByText("acme-sso")).toBeInTheDocument();
    expect(screen.getByText("https://idp.acme.example")).toBeInTheDocument();
    // Secret is never displayed back — only the configured state.
    expect(screen.getByText(/secret configured/i)).toBeInTheDocument();
    expect(screen.queryByText("sec-new")).not.toBeInTheDocument();
  });

  it("masks the client secret input on create", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(
      screen.getByRole("button", { name: "Configure provider" }),
    );
    expect(screen.getByLabelText(/Client secret/)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("blocks create when the client secret is empty", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(
      screen.getByRole("button", { name: "Configure provider" }),
    );
    await user.type(screen.getByLabelText(/Alias/), "acme-sso");
    await user.type(
      screen.getByLabelText(/Issuer URL/),
      "https://idp.acme.example",
    );
    await user.type(screen.getByLabelText(/Client ID/), "inari-acme");
    await user.click(screen.getByRole("button", { name: "Save provider" }));
    // Validation fails: the form stays open and no provider is created.
    expect(
      screen.getByRole("button", { name: "Save provider" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("acme-sso")).not.toBeInTheDocument();
    expect(policyMockControl.getState().idpProviders.acme).toBeUndefined();
  });

  it("shows the configured provider without exposing the secret", async () => {
    seedProvider();
    renderPage();
    expect(await screen.findByText("acme-sso")).toBeInTheDocument();
    expect(screen.getByText(/secret configured/i)).toBeInTheDocument();
    expect(screen.queryByText("sec-initial")).not.toBeInTheDocument();
    expect(screen.getByText("acme.example")).toBeInTheDocument();
    // One IdP per org: no "add another" affordance once configured.
    expect(
      screen.queryByRole("button", { name: "Configure provider" }),
    ).not.toBeInTheDocument();
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
    await user.type(
      await screen.findByLabelText(/New client secret/),
      "sec-rotated",
    );
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
    expect(
      await screen.findByText(/no SSO provider configured/i),
    ).toBeInTheDocument();
  });

  it("hides write controls for an org viewer", async () => {
    mockParsedToken = {};
    seedProvider();
    renderPage();
    await screen.findByText("acme-sso");
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Rotate secret" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});

function seedSamlProvider() {
  putIdpProviderMock("acme", {
    provider: "saml",
    alias: "acme-saml",
    entityId: "https://idp.acme.example/saml/metadata",
    ssoUrl: "https://idp.acme.example/saml/sso",
    nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:persistent",
    claimMapping: { email: "email", groups: "groups" },
    domainHints: ["acme.example"],
  });
}

const VALID_METADATA_XML = [
  `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.acme.example/saml/metadata">`,
  `  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`,
  `    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:persistent</md:NameIDFormat>`,
  `    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.acme.example/saml/sso"/>`,
  `  </md:IDPSSODescriptor>`,
  `</md:EntityDescriptor>`,
].join("\n");

describe("IdpBrokeringPage — SAML (M6.W8)", () => {
  it("creates a SAML provider via manual entry", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(
      screen.getByRole("button", { name: "Configure provider" }),
    );
    await user.selectOptions(screen.getByLabelText(/Provider type/), "saml");
    await user.type(screen.getByLabelText(/Alias/), "acme-saml");
    await user.type(
      screen.getByLabelText(/Entity ID/),
      "https://idp.acme.example/saml/metadata",
    );
    await user.type(
      screen.getByLabelText(/SSO URL/),
      "https://idp.acme.example/saml/sso",
    );
    await user.click(screen.getByRole("button", { name: "Save provider" }));
    expect(await screen.findByText("acme-saml")).toBeInTheDocument();
    expect(screen.getByText("SAML")).toBeInTheDocument();
    expect(
      screen.getByText("https://idp.acme.example/saml/metadata"),
    ).toBeInTheDocument();
    // SP descriptor exposure so the tenant can configure their IdP.
    expect(
      screen.getByRole("link", { name: /download sp descriptor/i }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/identity/provider/export"),
    );
    // SAML has no client secret: no rotate control, no secret badge.
    expect(
      screen.queryByRole("button", { name: "Rotate secret" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/secret configured/i)).not.toBeInTheDocument();
  });

  it("imports SAML metadata XML and prefills the manual fields", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(
      screen.getByRole("button", { name: "Configure provider" }),
    );
    await user.selectOptions(screen.getByLabelText(/Provider type/), "saml");
    await user.click(screen.getByLabelText(/Metadata XML/));
    await user.paste(VALID_METADATA_XML);
    await user.click(screen.getByRole("button", { name: "Import metadata" }));
    expect(await screen.findByLabelText(/Entity ID/)).toHaveValue(
      "https://idp.acme.example/saml/metadata",
    );
    expect(screen.getByLabelText(/SSO URL/)).toHaveValue(
      "https://idp.acme.example/saml/sso",
    );
  });

  it("imports SAML metadata from a URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(
      screen.getByRole("button", { name: "Configure provider" }),
    );
    await user.selectOptions(screen.getByLabelText(/Provider type/), "saml");
    await user.type(
      screen.getByLabelText(/Metadata URL/),
      "https://idp.acme.example/saml/metadata",
    );
    await user.click(screen.getByRole("button", { name: "Import metadata" }));
    expect(await screen.findByLabelText(/Entity ID/)).toHaveValue(
      "https://idp.acme.example/saml/metadata",
    );
  });

  it("surfaces an error when metadata import fails", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(
      screen.getByRole("button", { name: "Configure provider" }),
    );
    await user.selectOptions(screen.getByLabelText(/Provider type/), "saml");
    await user.click(screen.getByLabelText(/Metadata XML/));
    await user.paste("this is not xml");
    await user.click(screen.getByRole("button", { name: "Import metadata" }));
    expect(
      await screen.findByText(/could not parse SAML metadata/i),
    ).toBeInTheDocument();
  });

  it("blocks SAML create without entityId and ssoUrl", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no SSO provider configured/i);
    await user.click(
      screen.getByRole("button", { name: "Configure provider" }),
    );
    await user.selectOptions(screen.getByLabelText(/Provider type/), "saml");
    await user.type(screen.getByLabelText(/Alias/), "acme-saml");
    await user.click(screen.getByRole("button", { name: "Save provider" }));
    expect(
      screen.getByRole("button", { name: "Save provider" }),
    ).toBeInTheDocument();
    expect(policyMockControl.getState().idpProviders.acme).toBeUndefined();
  });

  it("edits a SAML provider", async () => {
    seedSamlProvider();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-saml");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const ssoUrl = screen.getByLabelText(/SSO URL/);
    await user.clear(ssoUrl);
    await user.type(ssoUrl, "https://idp.acme.example/saml/sso-v2");
    await user.click(screen.getByRole("button", { name: "Save provider" }));
    expect(
      await screen.findByText("https://idp.acme.example/saml/sso-v2"),
    ).toBeInTheDocument();
  });

  it("replaces the signing certificate", async () => {
    seedSamlProvider();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-saml");
    await user.click(
      screen.getByRole("button", { name: "Replace certificate" }),
    );
    const input = await screen.findByLabelText(/New signing certificate/);
    await user.click(input);
    await user.paste(
      "-----BEGIN CERTIFICATE-----\nMIIDNEW\n-----END CERTIFICATE-----",
    );
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText(/certificate updated/i)).toBeInTheDocument();
    // Expiry is surfaced after upload.
    expect(await screen.findByText(/certificate expires/i)).toBeInTheDocument();
  });
});
