import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { m4MockControl } from "@/mocks/fixtures/m4";
import { mockServer } from "@/mocks/server";
import { ScaffoldWizardPage } from "@/pages/templates/scaffold-wizard";
import { TemplateListPage } from "@/pages/templates/template-list";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m4MockControl.reset();
});
afterAll(() => mockServer.close());

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/acme/templates"]}>
      <Routes>
        <Route path="/:tenant/templates" element={<TemplateListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={["/acme/templates/web-service/scaffold"]}>
      <Routes>
        <Route
          path="/:tenant/templates/:templateId/scaffold"
          element={<ScaffoldWizardPage />}
        />
        <Route
          path="/:tenant/catalog/:itemId"
          element={<p>catalog entry page</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TemplateListPage", () => {
  it("lists golden-path templates with tags and scaffold CTA", async () => {
    renderList();
    expect(await screen.findByText("Web Service")).toBeInTheDocument();
    expect(screen.getByText("golden-path")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scaffold" })).toHaveAttribute(
      "href",
      "/acme/templates/web-service/scaffold",
    );
  });
});

describe("ScaffoldWizardPage", () => {
  it("completes the scaffold flow end-to-end: repo + pipeline + catalog entry", async () => {
    const user = userEvent.setup();
    renderWizard();

    // Configure: tenant context is bound automatically.
    expect(await screen.findByText("tenant-acme")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Service name"), "payments-api");
    await user.type(screen.getByLabelText(/Description/), "Payments API service");
    await user.type(screen.getByLabelText(/Port/), "8080");
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Review.
    expect(await screen.findByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText("payments-api")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Scaffold" }));

    // Status: run completes and exposes all three outputs.
    expect(await screen.findByText("Scaffold complete", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open repository" })).toHaveAttribute(
      "href",
      "https://github.com/acme/payments-api",
    );
    expect(screen.getByRole("link", { name: "Open pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View catalog entry" })).toHaveAttribute(
      "href",
      "/acme/catalog/discovered-payments-api",
    );
  }, 15_000);

  it("rejects invalid service names", async () => {
    const user = userEvent.setup();
    renderWizard();
    await screen.findByText("tenant-acme");
    await user.type(screen.getByLabelText("Service name"), "Bad Name");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText(/Use lowercase letters, numbers, and dashes/),
    ).toBeInTheDocument();
  });
});
