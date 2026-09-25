import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";
import { CatalogBrowsePage } from "@/pages/catalog/catalog-browse";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

let mockTenant = "acme";
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  mockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage(entry?: string) {
  return render(
    <MemoryRouter initialEntries={[entry ?? `/${mockTenant}/catalog`]}>
      <Routes>
        <Route path="/:tenant/catalog" element={<CatalogBrowsePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CatalogBrowsePage", () => {
  it("lists all catalog items with source", async () => {
    renderPage();
    expect(await screen.findByText("PostgreSQL on AWS")).toBeInTheDocument();
    expect(screen.getByText("cert-manager")).toBeInTheDocument();
    expect(screen.getByText("Keycloak Realm")).toBeInTheDocument();
    expect(screen.getAllByText("Curated").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Discovered").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0);
  });

  it("filters by source", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    await user.click(screen.getByRole("button", { name: "Curated" }));
    await waitFor(() => {
      expect(screen.getByText("PostgreSQL on AWS")).toBeInTheDocument();
      expect(screen.queryByText("Keycloak Realm")).not.toBeInTheDocument();
      expect(screen.queryByText("cert-manager")).not.toBeInTheDocument();
    });
  });

  it("filters by free-text search (debounced)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    await user.type(screen.getByLabelText("Search catalog"), "keycloak");
    await waitFor(
      () => {
        expect(screen.getByText("Keycloak Realm")).toBeInTheDocument();
        expect(screen.queryByText("PostgreSQL on AWS")).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("filters by category", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    await user.selectOptions(screen.getByLabelText("Filter by category"), "security");
    await waitFor(() => {
      expect(screen.getByText("Keycloak Realm")).toBeInTheDocument();
      expect(screen.queryByText("PostgreSQL on AWS")).not.toBeInTheDocument();
    });
  });

  it("sorts by name descending", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    await user.selectOptions(screen.getByLabelText("Sort catalog"), "name-desc");
    await waitFor(() => {
      const links = screen
        .getAllByRole("link")
        .map((l) => l.textContent)
        .filter((t) => ["PostgreSQL on AWS", "cert-manager", "Keycloak Realm", "Crossplane EKS"].includes(t ?? ""));
      expect(links[0]).toBe("PostgreSQL on AWS");
      expect(links[links.length - 1]).toBe("cert-manager");
    });
  });

  it("reflects filters in the URL and restores them on load", async () => {
    renderPage("/acme/catalog?source=platform&sort=newest&view=list");
    expect(await screen.findByText("Keycloak Realm")).toBeInTheDocument();
    expect(screen.queryByText("PostgreSQL on AWS")).not.toBeInTheDocument();
    // List view renders a table.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort catalog")).toHaveValue("newest");
  });

  it("toggles between grid and list views", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("List view"));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("database").length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText("Grid view"));
    await waitFor(() => expect(screen.queryByRole("table")).not.toBeInTheDocument());
  });

  it("clears all filters", async () => {
    const user = userEvent.setup();
    renderPage("/acme/catalog?source=platform&q=realm");
    await screen.findByText("Keycloak Realm");
    await user.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(await screen.findByText("PostgreSQL on AWS")).toBeInTheDocument();
    expect(screen.getByText("cert-manager")).toBeInTheDocument();
  });

  it("paginates with the server total", async () => {
    const { http, HttpResponse } = await import("msw");
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `cat-item-${String(i).padStart(2, "0")}`,
      name: `item-${String(i).padStart(2, "0")}`,
      displayName: `Item ${String(i).padStart(2, "0")}`,
      description: "generated",
      source: "curated",
      approvalPolicy: "auto",
      createdAt: "2026-01-01T00:00:00Z",
      versions: null,
    }));
    mockServer.use(
      http.get("*/api/v1/tenants/acme/catalog", ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get("offset") ?? "0");
        const limit = Number(url.searchParams.get("limit") ?? "0");
        const slice = limit > 0 ? many.slice(offset, offset + limit) : many;
        return HttpResponse.json({ items: slice, total: many.length });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Item 00")).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(screen.queryByText("Item 24")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Item 24")).toBeInTheDocument();
    expect(screen.queryByText("Item 00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("shows a category hint in the empty state when category and cluster filters combine", async () => {
    renderPage("/acme/catalog?category=bogus&cluster=cl-eks-prod");
    // Fixtures carry no discovered projections, so nothing matches.
    expect(await screen.findByText(/No catalog items match/)).toBeInTheDocument();
    expect(screen.getByText(/Discovered capabilities have no category/)).toBeInTheDocument();
  });

  it("links items to detail pages carrying tenant context", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /PostgreSQL on AWS/ });
    expect(link).toHaveAttribute("href", "/acme/catalog/cat-postgresql-aws");
  });

  it("shows latest version and channel per item", async () => {
    renderPage();
    await screen.findByText("PostgreSQL on AWS");
    expect(screen.getByText("v1.4.0")).toBeInTheDocument();
    expect(screen.getByText("v1.15.0")).toBeInTheDocument();
    expect(screen.getAllByText("stable").length).toBeGreaterThan(0);
  });

  it("renders versionless items with a dash instead of a broken version", async () => {
    renderPage();
    await screen.findByText("Crossplane EKS");
    expect(screen.getByLabelText("no version published")).toHaveTextContent("—");
  });

  it("renders an error message when the API fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/catalog", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/Failed to load catalog: boom/)).toBeInTheDocument();
  });
});
