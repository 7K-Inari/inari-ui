import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudAccountDetailPage } from "@/pages/cloud-accounts/cloud-account-detail";
import { mockControl } from "@/mocks/fixtures";
import { m3MockControl } from "@/mocks/fixtures/m3";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

let mockTenant = "acme";
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
beforeEach(() => {
  mockTenant = "acme";
  mockControl.reset();
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderDetail(accountId: string) {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/cloud-accounts/${accountId}`]}>
      <Routes>
        <Route
          path="/:tenant/cloud-accounts/:accountId"
          element={<CloudAccountDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CloudAccountDetailPage", () => {
  it("shows account fields, status and ProviderConfig for a connected account", async () => {
    renderDetail("ca-acme-prod");
    expect(await screen.findByRole("heading", { name: "acme-prod" })).toBeInTheDocument();
    expect(screen.getByTestId("status-connected")).toBeInTheDocument();
    expect(
      screen.getByText("arn:aws:iam::123456789012:role/inari-platform-access"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("provider-config-name")).toHaveTextContent("aws-acme-prod");
  });

  it("shows the trust snippet for the account", async () => {
    renderDetail("ca-acme-sandbox");
    expect(
      await screen.findByText(/sts:AssumeRoleWithWebIdentity/),
    ).toBeInTheDocument();
  });

  it("validates on demand: first attempt fails, retry connects the account", async () => {
    const user = userEvent.setup();
    renderDetail("ca-acme-sandbox");
    expect(await screen.findByTestId("status-pending_trust")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Validate now" }));
    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
    expect(screen.getByTestId("validation-error").textContent).toContain("AssumeRole denied");

    await user.click(screen.getByRole("button", { name: "Retry validation" }));
    expect(await screen.findByText("Account connected")).toBeInTheDocument();
    expect(screen.getAllByText("aws-acme-acme-sandbox").length).toBeGreaterThan(0);
    expect(await screen.findByTestId("provider-config-name")).toHaveTextContent(
      "aws-acme-acme-sandbox",
    );
  });
});
