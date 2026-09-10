import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";
import { EsoStoresPage } from "@/pages/settings/tokens/eso-stores";

let mockParsedToken: Record<string, unknown> | undefined = {
  organization: { acme: { name: "Acme", roles: ["admin"] } },
};
vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: mockParsedToken }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
beforeEach(() => {
  mockParsedToken = { organization: { acme: { name: "Acme", roles: ["admin"] } } };
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/acme/settings/tokens/eso-stores"]}>
      <Routes>
        <Route
          path="/:tenant/settings/tokens/eso-stores"
          element={<EsoStoresPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EsoStoresPage", () => {
  it("lists secret stores with scope and status badges", async () => {
    renderPage();
    expect(await screen.findByText("inari-platform")).toBeInTheDocument();
    expect(screen.getByText("acme-vault")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(await screen.findByText("delivered")).toBeInTheDocument();
    expect(await screen.findByText("pending")).toBeInTheDocument();
  });

  it("creates a store via the schema form", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    await user.type(screen.getByLabelText(/^Name/), "east-sm");
    await user.selectOptions(screen.getByLabelText(/Provider/), "awsSM");
    await user.type(screen.getByLabelText(/^Secret name\s*\*$/), "eso-aws-creds");
    await user.type(screen.getByLabelText(/^Secret namespace\s*\*$/), "external-secrets");
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(await screen.findByText("east-sm")).toBeInTheDocument();
    const created = policyMockControl
      .getState()
      .secretStores.acme.find((s) => s.name === "east-sm");
    expect(created?.provider.type).toBe("awsSM");
    expect(created?.provider.authSecretRef).toEqual({
      name: "eso-aws-creds",
      namespace: "external-secrets",
    });
  });

  it("rejects a missing name", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(
      (await screen.findAllByText(/must have required property 'Name'/)).length,
    ).toBeGreaterThan(0);
    expect(policyMockControl.getState().secretStores.acme).toHaveLength(2);
  });

  it("rejects an invalid store name", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    await user.type(screen.getByLabelText(/^Name/), "Bad_Name");
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(
      (await screen.findAllByText(/must match pattern/)).length,
    ).toBeGreaterThan(0);
    expect(policyMockControl.getState().secretStores.acme).toHaveLength(2);
  });

  it("requires a credentials secret reference", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    await user.type(screen.getByLabelText(/^Name/), "east-sm");
    await user.selectOptions(screen.getByLabelText(/Provider/), "awsSM");
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(
      (await screen.findAllByText(/must have required property 'Secret name'/)).length,
    ).toBeGreaterThan(0);
  });

  it("edits an org-owned store", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    const row = screen.getByText("acme-vault").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    const region = screen.getByLabelText(/Region/);
    await user.clear(region);
    await user.type(region, "eu-west-1");
    await user.click(screen.getByRole("button", { name: "Save store" }));
    await screen.findByText("acme-vault");
    const updated = policyMockControl
      .getState()
      .secretStores.acme.find((s) => s.name === "acme-vault");
    expect(updated?.provider.region).toBe("eu-west-1");
  });

  it("deletes an org-owned store after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    const row = screen.getByText("acme-vault").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    expect(
      policyMockControl
        .getState()
        .secretStores.acme.some((s) => s.name === "acme-vault"),
    ).toBe(false);
  });

  it("renders platform-scoped stores read-only even for admins", async () => {
    renderPage();
    await screen.findByText("inari-platform");
    const row = screen.getByText("inari-platform").closest("tr")!;
    expect(
      within(row).queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("hides write controls for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    await screen.findByText("acme-vault");
    expect(
      screen.queryByRole("button", { name: "New store" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Read-only (org viewer)")).toBeInTheDocument();
  });

  it("surfaces a duplicate-name 409 without creating the store", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    await user.type(screen.getByLabelText(/^Name/), "acme-vault");
    await user.selectOptions(screen.getByLabelText(/Provider/), "awsSM");
    await user.type(screen.getByLabelText(/^Secret name\s*\*$/), "x");
    await user.type(screen.getByLabelText(/^Secret namespace\s*\*$/), "y");
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(policyMockControl.getState().secretStores.acme).toHaveLength(2);
  });

  it("surfaces a list failure", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/:org/secret-stores", () =>
        HttpResponse.json(
          { title: "Error", status: 500, detail: "boom" },
          { status: 500 },
        ),
      ),
    );
    renderPage();
    expect(
      await screen.findByText(/Failed to load secret stores/),
    ).toBeInTheDocument();
  });

  it("cancel-during-edit then New store resets the form", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    const row = screen.getByText("acme-vault").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "New store" }));
    expect(screen.getByLabelText(/^Name/)).not.toBeDisabled();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("");
  });
});
