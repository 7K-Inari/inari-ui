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
    // Pending status surfaces the Ready condition reason and affected cluster.
    expect(await screen.findByText(/WaitingForAgent/)).toBeInTheDocument();
    expect(screen.getAllByText(/cl-kind-dev/).length).toBeGreaterThan(0);
    // Provider column derives the key from the populated sub-object.
    expect(screen.getByText("awsSM")).toBeInTheDocument();
    expect(screen.getByText("vault")).toBeInTheDocument();
  });

  it("renders clusterSetRef targets", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/:org/secret-stores", () =>
        HttpResponse.json({
          stores: [
            {
              id: "ss-1",
              name: "fleet-wide",
              orgId: "acme",
              scope: "cluster",
              targets: { clusterSetRef: "prod-set" },
              provider: {
                gcpsm: {
                  projectId: "acme-prod",
                  authSecretRef: { name: "eso-gcp", namespace: "external-secrets" },
                },
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText("fleet-wide")).toBeInTheDocument();
    expect(screen.getByText("prod-set")).toBeInTheDocument();
  });

  it("creates a store via the schema form", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    await user.type(screen.getByLabelText(/^Name/), "east-sm");
    await user.selectOptions(screen.getByLabelText(/Provider/), "awsSM");
    await user.type(screen.getByLabelText(/^Region/), "eu-west-1");
    await user.type(screen.getByLabelText(/^Secret name\s*\*$/), "eso-aws-creds");
    await user.type(screen.getByLabelText(/^Secret namespace\s*\*$/), "external-secrets");
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(await screen.findByText("east-sm")).toBeInTheDocument();
    const created = policyMockControl
      .getState()
      .secretStores.acme.find((s) => s.name === "east-sm");
    expect(created?.scope).toBe("cluster");
    expect(created?.provider.awsSM?.region).toBe("eu-west-1");
    expect(created?.provider.awsSM?.authSecretRef).toEqual({
      name: "eso-aws-creds",
      namespace: "external-secrets",
    });
    expect(created?.provider.vault).toBeUndefined();
    expect(created?.provider.gcpsm).toBeUndefined();
    expect(created?.provider.azurekv).toBeUndefined();
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

  it("requires a provider", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    await user.type(screen.getByLabelText(/^Name/), "east-sm");
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(await screen.findByText(/Select a provider/)).toBeInTheDocument();
    expect(policyMockControl.getState().secretStores.acme).toHaveLength(2);
  });

  it("requires the selected provider's config", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    await user.type(screen.getByLabelText(/^Name/), "east-sm");
    await user.selectOptions(screen.getByLabelText(/Provider/), "awsSM");
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(
      (await screen.findAllByText(/must have required property 'Region'/)).length,
    ).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText(/must have required property 'Secret name'/)).length,
    ).toBeGreaterThan(0);
    expect(policyMockControl.getState().secretStores.acme).toHaveLength(2);
  });

  it("only renders the selected provider's fields", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    await user.click(screen.getByRole("button", { name: "New store" }));
    expect(screen.queryByLabelText(/^Region/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Server URL/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Provider/), "vault");
    expect(screen.getByLabelText(/Server URL/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Region/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/GCP project ID/)).not.toBeInTheDocument();
  });

  it("edits an org-owned store and PATCHes only provider/targets", async () => {
    const { http } = await import("msw");
    let patchBody: Record<string, unknown> | null = null;
    mockServer.use(
      http.patch("*/api/v1/tenants/:org/secret-stores/:name", async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        // Fall through to the default handler semantics.
        const { updateSecretStoreMock } = await import("@/mocks/fixtures/m6");
        const store = updateSecretStoreMock("acme", "acme-vault", patchBody!);
        const { HttpResponse } = await import("msw");
        return HttpResponse.json({ store });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    const row = screen.getByText("acme-vault").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    const url = screen.getByLabelText(/Server URL/);
    await user.clear(url);
    await user.type(url, "https://vault-eu.acme.example");
    await user.click(screen.getByRole("button", { name: "Save store" }));
    await screen.findByText("acme-vault");
    const updated = policyMockControl
      .getState()
      .secretStores.acme.find((s) => s.name === "acme-vault");
    expect(updated?.provider.vault?.server).toBe("https://vault-eu.acme.example");
    expect(patchBody).not.toBeNull();
    expect(patchBody!).not.toHaveProperty("name");
    expect(patchBody!).not.toHaveProperty("scope");
    expect(Object.keys(patchBody!).sort()).toEqual(["provider", "targets"]);
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

  it("surfaces a delete failure and keeps the store", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.delete("*/api/v1/tenants/:org/secret-stores/:name", () =>
        HttpResponse.json(
          { title: "Error", status: 500, detail: "delete boom" },
          { status: 500 },
        ),
      ),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    const row = screen.getByText("acme-vault").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/delete boom/)).toBeInTheDocument();
    expect(
      policyMockControl
        .getState()
        .secretStores.acme.some((s) => s.name === "acme-vault"),
    ).toBe(true);
  });

  it("keeps the list usable when the status endpoint fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/:org/secret-stores/:name/status", () =>
        HttpResponse.json(
          { title: "Error", status: 500, detail: "status boom" },
          { status: 500 },
        ),
      ),
    );
    renderPage();
    expect(await screen.findByText("acme-vault")).toBeInTheDocument();
    expect(screen.getByText("inari-platform")).toBeInTheDocument();
    expect(screen.queryByText("delivered")).not.toBeInTheDocument();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
    expect((await screen.findAllByText("status unavailable")).length).toBe(2);
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
    await user.type(screen.getByLabelText(/^Region/), "us-east-1");
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

  it("switching provider type sends only the new provider key", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("acme-vault");
    const row = screen.getByText("acme-vault").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    await user.selectOptions(screen.getByLabelText(/Provider/), "gcpsm");
    await user.type(screen.getByLabelText(/GCP project ID/), "acme-prod");
    await user.type(screen.getByLabelText(/^Secret name\s*\*$/), "eso-gcp-creds");
    await user.type(screen.getByLabelText(/^Secret namespace\s*\*$/), "external-secrets");
    await user.click(screen.getByRole("button", { name: "Save store" }));
    await screen.findByText("acme-vault");
    const updated = policyMockControl
      .getState()
      .secretStores.acme.find((s) => s.name === "acme-vault");
    expect(updated?.provider.gcpsm?.projectId).toBe("acme-prod");
    // The vault config is replaced wholesale — no stale keys leak across.
    expect(updated?.provider.vault).toBeUndefined();
    expect(Object.keys(updated?.provider ?? {}).sort()).toEqual(["gcpsm"]);
  });
});
