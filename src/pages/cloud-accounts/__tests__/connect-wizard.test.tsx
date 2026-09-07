import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectAccountWizardPage } from "@/pages/cloud-accounts/connect-wizard";
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

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/cloud-accounts/new`]}>
      <Routes>
        <Route path="/:tenant/cloud-accounts/new" element={<ConnectAccountWizardPage />} />
        <Route path="/:tenant/cloud-accounts/:accountId" element={<div>account detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("AWS account ID"), "444455556666");
  await user.type(
    screen.getByLabelText("Role ARN"),
    "arn:aws:iam::444455556666:role/inari-platform-access",
  );
  await user.click(screen.getByRole("button", { name: "Create account record" }));
}

describe("ConnectAccountWizardPage", () => {
  it("validates the account ID and role ARN formats client-side", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText("AWS account ID"), "123");
    await user.type(screen.getByLabelText("Role ARN"), "not-an-arn");
    await user.click(screen.getByRole("button", { name: "Create account record" }));
    expect(await screen.findByText(/12-digit AWS account ID/)).toBeInTheDocument();
    expect(screen.getByText(/arn:aws:iam::<12-digit account>:role/)).toBeInTheDocument();
  });

  it("registers the account and shows the trust role values to configure", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);

    // Step 2 surfaces the real role values (no server-side trust snippet exists).
    expect((await screen.findAllByText("Create the trust role")).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("arn:aws:iam::444455556666:role/inari-platform-access").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("inari-acme-444455556666")).toBeInTheDocument();
    expect(screen.getByText(/oidc.eks.eu-west-1.amazonaws.com/)).toBeInTheDocument();
  });

  it("fails the first validation and connects on retry", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);
    await screen.findAllByText("Create the trust role");

    await user.click(screen.getByRole("button", { name: /I've created the role/ }));
    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
    expect(screen.getByTestId("validation-error").textContent).toContain("AssumeRole denied");

    await user.click(screen.getByRole("button", { name: "Retry validation" }));
    expect(await screen.findByText("Account connected")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open account detail" }),
    ).toHaveAttribute("href", "/acme/cloud-accounts/ca-acme-444455556666");
  });
});
