import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";
import { CatalogItemDetailPage } from "@/pages/catalog/catalog-item-detail";

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

function renderPage(itemId = "cat-postgresql-aws") {
  return render(
    <MemoryRouter initialEntries={[`/acme/catalog/${itemId}`]}>
      <Routes>
        <Route path="/:tenant/catalog/:itemId" element={<CatalogItemDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CatalogItemDetailPage", () => {
  it("shows docs, versions, schema preview and policy summary", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "PostgreSQL on AWS" })).toBeInTheDocument();
    expect(screen.getByText(/Provisions an RDS instance/)).toBeInTheDocument();
    expect(screen.getByLabelText("Version")).toHaveValue("1.4.0");
    expect(screen.getByText(/deprecated/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PostgreSQL engine version/)).toBeInTheDocument();
    expect(screen.getByText(/GitOps mode: pull request/i)).toBeInTheDocument();
    expect(screen.getByText(/Cost guardrail/)).toBeInTheDocument();
  });

  it("deploy CTA carries tenant and pinned version", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "PostgreSQL on AWS" });
    await user.selectOptions(screen.getByLabelText("Version"), "1.3.0");
    const cta = screen.getByRole("link", { name: "Deploy" });
    expect(cta).toHaveAttribute(
      "href",
      "/acme/catalog/cat-postgresql-aws/deploy?version=1.3.0",
    );
  });

  it("schema preview is read-only", async () => {
    renderPage();
    const field = await screen.findByLabelText(/PostgreSQL engine version/);
    expect(field).toBeDisabled();
  });

  it("shows approval requirement for platform items", async () => {
    renderPage("cat-keycloak-realm");
    expect(await screen.findByText(/Approval required/)).toBeInTheDocument();
  });

  it("shows a not-found message for unknown items", async () => {
    renderPage("cat-nope");
    expect(await screen.findByText(/Catalog item not found/)).toBeInTheDocument();
  });
});
