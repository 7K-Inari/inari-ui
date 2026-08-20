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
  await user.type(screen.getByLabelText("Name"), "acme-test");
  await user.type(screen.getByLabelText("AWS account ID"), "444455556666");
  await user.click(screen.getByRole("button", { name: "Create account record" }));
}

describe("ConnectAccountWizardPage", () => {
  it("validates the name and account ID formats client-side", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText("Name"), "Bad_Name");
    await user.type(screen.getByLabelText("AWS account ID"), "123");
    await user.click(screen.getByRole("button", { name: "Create account record" }));
    expect(
      await screen.findByText(/lowercase letters, numbers, and dashes/),
    ).toBeInTheDocument();
    expect(screen.getByText(/12-digit AWS account ID/)).toBeInTheDocument();
  });

  it("shows the trust snippet with ExternalId and sub condition after creating the record", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);

    expect(
      await screen.findAllByText(/system:serviceaccount:inari-system:crossplane-provider-aws/),
    ).not.toHaveLength(0);
    expect(screen.getByText("inari-acme-ca-acme-acme-test")).toBeInTheDocument();
    expect(screen.getByText(/sts:AssumeRoleWithWebIdentity/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Terraform" }));
    expect(screen.getByText(/aws_iam_role/)).toBeInTheDocument();
  });

  it("fails the first validation and connects on retry", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);
    await screen.findByText(/sts:AssumeRoleWithWebIdentity/);

    await user.click(screen.getByRole("button", { name: /I've created the role/ }));
    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
    expect(screen.getByTestId("validation-error").textContent).toContain("AssumeRole denied");

    await user.click(screen.getByRole("button", { name: "Retry validation" }));
    expect(await screen.findByText("Account connected")).toBeInTheDocument();
    expect(screen.getByText("aws-acme-acme-test")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open account detail" }),
    ).toHaveAttribute("href", "/acme/cloud-accounts/ca-acme-acme-test");
  });
});
