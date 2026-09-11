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
import { OrgDomainsPage } from "@/pages/settings/org/domains";

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
    <MemoryRouter initialEntries={["/acme/settings/org/domains"]}>
      <Routes>
        <Route
          path="/:tenant/settings/org/domains"
          element={<OrgDomainsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function seedProvider(
  domainHints: string[] = ["acme.example", "*.subs.acme.example"],
) {
  putIdpProviderMock("acme", {
    provider: "oidc",
    alias: "acme-sso",
    issuerUrl: "https://idp.acme.example",
    clientId: "inari-acme",
    clientSecret: "sec-initial",
    claimMapping: { email: "email", groups: "groups" },
    domainHints,
  });
}

describe("OrgDomainsPage", () => {
  it("lists claimed domains with exact/wildcard badges", async () => {
    seedProvider();
    renderPage();
    expect(await screen.findByText("acme.example")).toBeInTheDocument();
    expect(screen.getByText("*.subs.acme.example")).toBeInTheDocument();
    expect(screen.getByText("Exact")).toBeInTheDocument();
    expect(screen.getByText("Wildcard")).toBeInTheDocument();
  });

  it("shows an empty state explaining login routing when no domains are claimed", async () => {
    renderPage();
    expect(await screen.findByText(/no domains claimed/i)).toBeInTheDocument();
  });

  it("adds a domain", async () => {
    seedProvider(["acme.example"]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme.example");
    await user.type(screen.getByLabelText(/Add domain/), "mail.acme.example");
    await user.click(screen.getByRole("button", { name: "Add domain" }));
    expect(await screen.findByText("mail.acme.example")).toBeInTheDocument();
  });

  it("rejects an invalid domain without calling the server", async () => {
    seedProvider(["acme.example"]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme.example");
    await user.type(screen.getByLabelText(/Add domain/), "not a domain!");
    await user.click(screen.getByRole("button", { name: "Add domain" }));
    expect(
      await screen.findByText(/enter a valid domain/i),
    ).toBeInTheDocument();
    expect(policyMockControl.getState().idpProviders.acme.domainHints).toEqual([
      "acme.example",
    ]);
  });

  it("rejects a duplicate domain without calling the server", async () => {
    seedProvider(["acme.example"]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme.example");
    // Case-insensitive duplicate: input is normalized to lowercase first.
    await user.type(screen.getByLabelText(/Add domain/), "ACME.example");
    await user.click(screen.getByRole("button", { name: "Add domain" }));
    expect(await screen.findByText(/already listed/i)).toBeInTheDocument();
    expect(policyMockControl.getState().idpProviders.acme.domainHints).toEqual([
      "acme.example",
    ]);
  });

  it("surfaces the server 409 when a domain is claimed by another organization", async () => {
    seedProvider(["acme.example"]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme.example");
    // example.com is claimed by globex in the fixtures.
    await user.type(screen.getByLabelText(/Add domain/), "example.com");
    await user.click(screen.getByRole("button", { name: "Add domain" }));
    expect(
      await screen.findByText(/already claimed by another organization/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("example.com")).not.toBeInTheDocument();
  });

  it("removes a domain", async () => {
    seedProvider(["acme.example", "mail.acme.example"]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("mail.acme.example");
    const row = screen.getByText("mail.acme.example").closest("tr")!;
    await user.click(
      Array.from(row.querySelectorAll("button")).find(
        (b) => b.textContent === "Remove",
      )!,
    );
    expect(screen.queryByText("mail.acme.example")).not.toBeInTheDocument();
    expect(screen.getByText("acme.example")).toBeInTheDocument();
  });

  it("is read-only for an org viewer", async () => {
    mockParsedToken = {};
    seedProvider();
    renderPage();
    await screen.findByText("acme.example");
    expect(screen.queryByLabelText(/Add domain/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
