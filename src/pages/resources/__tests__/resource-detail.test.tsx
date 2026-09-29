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
  it("shows status, spec and cluster ID", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "orders-db" })).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText(/cluster cl-eks-prod/)).toBeInTheDocument();
    expect(screen.getByText(/"storageGi": 100/)).toBeInTheDocument();
    // InstanceView has no composed-resources or ArgoCD deep link in the contract.
    expect(screen.queryByText(/Composed resources/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open in ArgoCD" })).not.toBeInTheDocument();
  });

  it("shows an empty actions menu when no extensions contribute actions", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "orders-db" });
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByText(/No extension actions available/)).toBeInTheDocument();
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

describe("edit spec", () => {
  it("edits the spec via the schema form and saves", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "orders-db" });

    const storage = await screen.findByLabelText(/Storage \(Gi\)/);
    await user.clear(storage);
    await user.type(storage, "200");
    await user.click(screen.getByRole("button", { name: "Save spec" }));

    expect(await screen.findByText(/Spec update submitted/)).toBeInTheDocument();
  });

  it("surfaces API errors inline", async () => {
    const user = userEvent.setup();
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.patch("*/api/v1/tenants/acme/instances/:id", () =>
        HttpResponse.json({ title: "Error", status: 500, detail: "boom" }, { status: 500 }),
      ),
    );
    renderPage();
    await screen.findByRole("heading", { name: "orders-db" });
    await screen.findByLabelText(/Storage \(Gi\)/);
    await user.click(screen.getByRole("button", { name: "Save spec" }));
    expect(await screen.findByText(/boom|Spec update failed/)).toBeInTheDocument();
  });
});

describe("rollback", () => {
  it("offers older catalog versions and rolls back", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "orders-db" });

    const select = await screen.findByLabelText("Target version");
    expect(select).toHaveValue("1.2.1");
    await user.click(screen.getByRole("button", { name: "Rollback to 1.2.1" }));
    expect(await screen.findByText(/Rollback to 1\.2\.1 submitted/)).toBeInTheDocument();
  });

  it("hides the rollback card when no older version exists", async () => {
    const { http, HttpResponse } = await import("msw");
    const { findCatalogItem } = await import("@/mocks/fixtures/catalog");
    const item = findCatalogItem("cat-postgresql-aws")!;
    mockServer.use(
      http.get("*/api/v1/tenants/acme/catalog/:item", () =>
        HttpResponse.json({
          item: { ...item, versions: (item.versions ?? []).filter((v) => v.version === "1.4.0") },
        }),
      ),
    );
    renderPage("ri-payments-db");
    await screen.findByRole("heading", { name: "payments-db" });
    await screen.findByText(/Edit spec/);
    expect(screen.queryByText("Rollback")).not.toBeInTheDocument();
  });
});

describe("delete (undeploy)", () => {
  it("deletes the instance and navigates back to the list", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/acme/deploys/ri-orders-db"]}>
        <Routes>
          <Route path="/:tenant/deploys/:instanceId" element={<ResourceDetailPage />} />
          <Route path="/:tenant/deploys" element={<p>deploys list</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "orders-db" });
    await user.click(screen.getByRole("button", { name: "Delete resource" }));
    expect(await screen.findByText("deploys list")).toBeInTheDocument();
  });

  it("shows the approval notice when the delete is gated", async () => {
    const user = userEvent.setup();
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.delete("*/api/v1/tenants/acme/instances/:id", () =>
        HttpResponse.json({
          deploy: {
            InstanceID: "ri-orders-db",
            Version: "1.3.0",
            Status: "pending_approval",
            ApprovalID: "ap-1",
          },
        }),
      ),
    );
    renderPage();
    await screen.findByRole("heading", { name: "orders-db" });
    await user.click(screen.getByRole("button", { name: "Delete resource" }));
    expect(await screen.findByText(/gated on approval/)).toBeInTheDocument();
  });

  it("surfaces API errors inline", async () => {
    const user = userEvent.setup();
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.delete("*/api/v1/tenants/acme/instances/:id", () =>
        HttpResponse.json(
          { title: "Error", status: 409, detail: "tenant has no git config" },
          { status: 409 },
        ),
      ),
    );
    renderPage();
    await screen.findByRole("heading", { name: "orders-db" });
    await user.click(screen.getByRole("button", { name: "Delete resource" }));
    expect(await screen.findByText(/tenant has no git config/)).toBeInTheDocument();
  });
});
