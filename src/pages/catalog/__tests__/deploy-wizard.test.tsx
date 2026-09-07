import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";
import { DeployWizardPage } from "@/pages/catalog/deploy-wizard";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
afterAll(() => mockServer.close());

function renderWizard() {
  return render(
    <MemoryRouter
      initialEntries={["/acme/catalog/cat-postgresql-aws/deploy?version=1.4.0"]}
    >
      <Routes>
        <Route path="/:tenant/catalog/:itemId/deploy" element={<DeployWizardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillConfigure(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText(/PostgreSQL engine version/);
  await user.type(screen.getByLabelText("Instance name"), "orders-db-2");
  await user.selectOptions(screen.getByLabelText("Target cluster"), "cl-eks-prod");
  // Touch the form so the schema defaults are captured into the submitted spec.
  const storage = screen.getByLabelText(/Storage \(Gi\)/);
  await user.clear(storage);
  await user.type(storage, "100");
}

describe("DeployWizardPage", () => {
  it("renders the schema form from the version schema and uiHints", async () => {
    renderWizard();
    const engine = await screen.findByLabelText(/PostgreSQL engine version/);
    expect(engine).toBeInTheDocument();
    expect(engine).not.toBeDisabled();
    // Schema defaults render as initial field values.
    expect(screen.getByLabelText("Instance class")).toHaveValue("db.t3.medium");
    expect(screen.queryByText(/Locked by platform policy/)).not.toBeInTheDocument();
  });

  it("blocks advancing without a name and target cluster", async () => {
    const user = userEvent.setup();
    renderWizard();
    await screen.findByLabelText(/PostgreSQL engine version/);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/Instance name is required/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Configure" })).toBeInTheDocument();
  });

  it("walks configure → review → submit → live status to healthy", async () => {
    const user = userEvent.setup();
    let submittedBody: unknown = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.post("*/api/v1/tenants/acme/deploys", async ({ request }) => {
        submittedBody = await request.json();
        return HttpResponse.json(
          {
            deploy: {
              InstanceID: "dep-test",
              Version: "1.4.0",
              Status: "deploying",
              CommitSHA: "",
              PRURL: "https://github.com/acme/acme-inari-state/pull/101",
              ApprovalID: "",
            },
          },
          { status: 201 },
        );
      }),
      http.get("*/api/v1/tenants/acme/instances/dep-test", () =>
        HttpResponse.json({
          instance: {
            id: "ri-orders-db-2",
            orgId: "acme",
            clusterId: "cl-eks-prod",
            catalogItemId: "cat-postgresql-aws",
            version: "1.4.0",
            resourceRef: { name: "orders-db-2" },
            health: "healthy",
            state: "healthy",
            statusMessage: "",
            prUrl: "https://github.com/acme/acme-inari-state/pull/101",
            createdAt: new Date().toISOString(),
          },
        }),
      ),
    );

    renderWizard();
    await fillConfigure(user);
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText(/orders-db-2/)).toBeInTheDocument();
    expect(screen.getByText(/eks-prod-eu/)).toBeInTheDocument();
    expect(screen.getAllByText(/1\.4\.0/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Deploy" }));

    await waitFor(() => expect(submittedBody).not.toBeNull());
    const body = submittedBody as {
      itemId: string;
      version: string;
      clusterId: string;
      name: string;
      spec: Record<string, unknown>;
    };
    expect(body).toMatchObject({
      itemId: "cat-postgresql-aws",
      version: "1.4.0",
      clusterId: "cl-eks-prod",
      name: "orders-db-2",
    });
    expect(body.spec.instanceClass).toBe("db.t3.medium");
    expect(body.spec.storageGi).toBe(100);

    expect(
      await screen.findByText(/Deploy healthy/, undefined, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/pull request/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Open pull request" }),
    ).toHaveAttribute("href", "https://github.com/acme/acme-inari-state/pull/101");
    expect(screen.getByRole("link", { name: "View resource instance" })).toHaveAttribute(
      "href",
      "/acme/deploys/ri-orders-db-2",
    );
  }, 15000);

  it("shows policy denial reason and remediation when OPA blocks the deploy", async () => {
    const user = userEvent.setup();
    renderWizard();
    await screen.findByLabelText(/PostgreSQL engine version/);
    await user.type(screen.getByLabelText("Instance name"), "policy-denied");
    await user.selectOptions(screen.getByLabelText("Target cluster"), "cl-eks-prod");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "Review" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Deploy" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Blocked by platform policy");
    expect(alert).toHaveTextContent(/denied by policy inari\.storage\/max-size/);
    expect(alert).toHaveTextContent(/Remediation:/);
    expect(alert).toHaveTextContent(/Reduce spec\.storage\.size to 100Gi or less/);
    // Stays on the review step so the user can adjust the spec.
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
  });
});
