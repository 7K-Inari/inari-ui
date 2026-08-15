import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { mockControl } from "@/mocks/fixtures";
import { mockCatalogControl } from "@/mocks/fixtures/catalog";
import { mockServer } from "@/mocks/server";
import { ResourceDetailPage } from "@/pages/resources/resource-detail";

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
  mockCatalogControl.reset();
});
afterAll(() => mockServer.close());

function renderPage(id = "ri-orders-db") {
  return render(
    <MemoryRouter initialEntries={[`/acme/deploys/${id}`]}>
      <Routes>
        <Route path="/:tenant/deploys/:instanceId" element={<ResourceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResourceDetailPage", () => {
  it("shows status, spec, composed resources and an ArgoCD deep link", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "orders-db" })).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("RDSInstance")).toBeInTheDocument();
    expect(screen.getByText("orders-db-conn")).toBeInTheDocument();
    expect(screen.getByText(/"storageGi": 100/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in ArgoCD" })).toHaveAttribute(
      "href",
      "https://argocd.eks-prod-eu.example.com/applications/orders-db",
    );
  });

  it("shows an actions placeholder menu", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "orders-db" });
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByText(/Extension actions will appear here/)).toBeInTheDocument();
  });

  it("shows a not-found message for unknown instances", async () => {
    renderPage("ri-nope");
    expect(await screen.findByText(/Resource not found/)).toBeInTheDocument();
  });
});

describe("upgrade flow", () => {
  it("offers a new-version banner, diff preview and one-click upgrade", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByText(/New version available: 1\.3\.0 → 1\.4\.0/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview upgrade" }));
    expect(await screen.findByText(/version: 1\.3\.0/)).toBeInTheDocument();
    expect(screen.getByText(/version: 1\.4\.0/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Upgrade to 1.4.0" }));
    await waitFor(() =>
      expect(screen.queryByText(/New version available/)).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/Upgrade to 1\.4\.0 submitted/)).toBeInTheDocument();
  });

  it("shows no upgrade banner when up to date", async () => {
    renderPage("ri-payments-db");
    await screen.findByRole("heading", { name: "payments-db" });
    expect(screen.queryByText(/New version available/)).not.toBeInTheDocument();
  });
});
