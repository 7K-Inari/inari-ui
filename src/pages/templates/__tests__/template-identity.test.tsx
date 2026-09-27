import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { policyMockControl } from "@/mocks/fixtures/m6";
import { m4MockControl } from "@/mocks/fixtures/m4";
import { mockServer } from "@/mocks/server";
import { CatalogBrowsePage } from "@/pages/catalog/catalog-browse";
import { CatalogItemDetailPage } from "@/pages/catalog/catalog-item-detail";
import { ScaffoldWizardPage } from "@/pages/templates/scaffold-wizard";
import { TemplateListPage } from "@/pages/templates/template-list";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

let currentTenant = "acme";
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: currentTenant }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m4MockControl.reset();
  policyMockControl.reset();
  currentTenant = "acme";
});
afterAll(() => mockServer.close());

function renderTemplateList() {
  return render(
    <MemoryRouter initialEntries={[`/${currentTenant}/templates`]}>
      <Routes>
        <Route path="/:tenant/templates" element={<TemplateListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWizard(templateId: string) {
  return render(
    <MemoryRouter
      initialEntries={[`/${currentTenant}/templates/${templateId}/scaffold`]}
    >
      <Routes>
        <Route
          path="/:tenant/templates/:templateId/scaffold"
          element={<ScaffoldWizardPage />}
        />
        <Route
          path="/:tenant/settings/org/git-connections"
          element={<p>git connections page</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function reachReviewStep(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(`tenant-${currentTenant}`);
  await user.type(screen.getByLabelText("Service name"), "my-site");
  await user.type(screen.getByLabelText(/Description/), "My site");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Review" });
}

describe("template scope badges", () => {
  it("badges user-scope templates distinctly from platform-scope templates in the template list", async () => {
    renderTemplateList();
    expect(await screen.findByText("Web Service")).toBeInTheDocument();
    expect(screen.getByText("Personal Site")).toBeInTheDocument();
    expect(screen.getByText("Personal git")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
  });

  it("badges a user-scope catalog item in browse and detail from the catalog payload", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/catalog", () =>
        HttpResponse.json({
          items: [
            {
              id: "cat-personal-site",
              name: "personal-site",
              displayName: "Personal Site",
              description: "User-scope template.",
              source: "template",
              category: "scaffolds",
              approvalPolicy: "auto",
              scope: "user",
              versions: null,
            },
          ],
          total: 1,
        }),
      ),
      http.get("*/api/v1/tenants/:org/catalog/:item", () =>
        HttpResponse.json({
          item: {
            id: "cat-personal-site",
            name: "personal-site",
            displayName: "Personal Site",
            description: "User-scope template.",
            source: "template",
            category: "scaffolds",
            approvalPolicy: "auto",
            scope: "user",
            versions: null,
          },
        }),
      ),
    );

    const browse = render(
      <MemoryRouter initialEntries={["/acme/catalog"]}>
        <Routes>
          <Route path="/:tenant/catalog" element={<CatalogBrowsePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Personal git")).toBeInTheDocument();
    browse.unmount();

    render(
      <MemoryRouter initialEntries={["/acme/catalog/cat-personal-site"]}>
        <Routes>
          <Route
            path="/:tenant/catalog/:itemId"
            element={<CatalogItemDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Personal git")).toBeInTheDocument();
  });
});

describe("scaffold wizard identity preview", () => {
  it("shows the platform App identity for platform-scope templates", async () => {
    renderWizard("web-service");
    expect(
      await screen.findByText(/platform App/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/will commit as/)).not.toBeInTheDocument();
  });

  it("shows the connected git login for user-scope templates", async () => {
    renderWizard("personal-site");
    expect(
      await screen.findByText(/will commit as/),
    ).toBeInTheDocument();
    expect(screen.getByText("ada-dev")).toBeInTheDocument();
    expect(screen.getByText(/\(GitHub\)/)).toBeInTheDocument();
  });

  it("warns with a deep link to git connections when no account is connected", async () => {
    currentTenant = "globex";
    renderWizard("personal-site");
    expect(
      await screen.findByText("No personal git connection"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Connect a git account" }),
    ).toHaveAttribute("href", "/globex/settings/org/git-connections");
  });
});

describe("scaffold run identity and fallback", () => {
  it("handles a 409 fallback-block with an explanation and deep link", async () => {
    const user = userEvent.setup();
    currentTenant = "globex";
    m4MockControl.setFallbackPolicy("block");
    renderWizard("personal-site");
    await reachReviewStep(user);
    await user.click(screen.getByRole("button", { name: "Scaffold" }));

    expect(
      await screen.findByText("Personal git connection required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not allow using the platform App identity/),
    ).toBeInTheDocument();
    // Both the pre-run warning and the 409 notice deep-link to git connections.
    for (const link of screen.getAllByRole("link", {
      name: "Connect a git account",
    })) {
      expect(link).toHaveAttribute("href", "/globex/settings/org/git-connections");
    }
  });

  it("shows the user commit identity on the status step", async () => {
    const user = userEvent.setup();
    renderWizard("personal-site");
    await reachReviewStep(user);
    await user.click(screen.getByRole("button", { name: "Scaffold" }));

    expect(await screen.findByText("Commits as")).toBeInTheDocument();
    expect(screen.getByText("ada-dev (GitHub)")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
  });

  it("shows the audited platform App fallback notice when fallback is used", async () => {
    const user = userEvent.setup();
    currentTenant = "globex";
    renderWizard("personal-site");
    await reachReviewStep(user);
    await user.click(screen.getByRole("button", { name: "Scaffold" }));

    expect(await screen.findByText("Commits as")).toBeInTheDocument();
    expect(screen.getByText("Platform App")).toBeInTheDocument();
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.getByText(/The run is audited\./)).toBeInTheDocument();
  });

  it("never renders token material in the identity UI", async () => {
    const user = userEvent.setup();
    renderWizard("personal-site");
    await reachReviewStep(user);
    await user.click(screen.getByRole("button", { name: "Scaffold" }));
    await screen.findByText("Commits as");
    expect(document.body.textContent).not.toMatch(
      /access_token|refresh_token|accessToken|refreshToken|Authorization|gho_/,
    );
  });
});
