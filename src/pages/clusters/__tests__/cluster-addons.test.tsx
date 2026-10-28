import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ClusterAddonsPage } from "@/pages/clusters/cluster-addons";
import { addonsMockControl } from "@/mocks/fixtures/addons";
import { gitReposMockControl } from "@/mocks/fixtures/git-repos";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    token: "test-token",
    parsedToken: { organization: { acme: { name: "Acme", roles: ["admin"] } } },
  }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  addonsMockControl.reset();
  gitReposMockControl.reset();
});
beforeEach(() => {
  addonsMockControl.reset();
  gitReposMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage(initialPath = "/acme/clusters/cl-kind-dev/addons") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/:tenant/clusters/:clusterId/addons" element={<ClusterAddonsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ClusterAddonsPage", () => {
  it("lists managed addons with version, badges, repo, git, and prune columns", async () => {
    renderPage();
    expect(await screen.findByText("cat-cert-manager")).toBeInTheDocument();
    expect(screen.getByText("cat-external-secrets")).toBeInTheDocument();
    expect(screen.getByText("cat-istio")).toBeInTheDocument();

    const row = screen.getByText("cat-cert-manager").closest("tr")!;
    expect(within(row).getByText("1.15.0")).toBeInTheDocument();
    expect(within(row).getByText("Healthy")).toBeInTheDocument();
    expect(within(row).getByText("Synced")).toBeInTheDocument();
    expect(within(row).getByText("baseline")).toBeInTheDocument();
    expect(within(row).getByText("a1b2c3d")).toBeInTheDocument();
    expect(within(row).getByText("prune off")).toBeInTheDocument();
    expect(within(row).getByText(/managed/i)).toBeInTheDocument();

    // PR-policy repo shows the opened PR link instead of a commit SHA.
    const esoRow = screen.getByText("cat-external-secrets").closest("tr")!;
    const prLink = within(esoRow).getByRole("link", { name: /pull request/i });
    expect(prLink).toHaveAttribute(
      "href",
      "https://github.com/acme/team-alpha-gitops/pull/42",
    );
    expect(within(esoRow).getByText("prune on")).toBeInTheDocument();

    // Fleet rows carry an ApplicationSet badge.
    const fleetRow = screen.getByText("cat-monitoring-stack").closest("tr")!;
    expect(within(fleetRow).getByText("ApplicationSet")).toBeInTheDocument();

    // Failed updates surface their state.
    const istioRow = screen.getByText("cat-istio").closest("tr")!;
    expect(within(istioRow).getByText("update failed")).toBeInTheDocument();
  });

  it("switches to the Discovered tab and shows scanner details", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("cat-cert-manager");
    await user.click(screen.getByRole("tab", { name: /discovered/i }));

    const row = (await screen.findByText("cat-metrics-server")).closest("tr")!;
    expect(within(row).getByText("metrics-server")).toBeInTheDocument();
    expect(within(row).getByText("kube-system")).toBeInTheDocument();
    expect(within(row).getByText("3.12.1")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: /adopt into gitops/i }),
    ).toBeInTheDocument();
  });

  it("shows empty states when there are no addons", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters/cl-kind-dev/addons", () =>
        HttpResponse.json({ addons: [] }),
      ),
    );
    renderPage();
    expect(await screen.findByText("No managed addons")).toBeInTheDocument();
    renderPage("/acme/clusters/cl-kind-dev/addons?tab=discovered");
    expect(await screen.findAllByText("Nothing discovered")).not.toHaveLength(0);
  });

  it("shows an error state when the list fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/clusters/cl-kind-dev/addons", () =>
        HttpResponse.json(
          { title: "Error", status: 500, detail: "boom" },
          { status: 500 },
        ),
      ),
    );
    renderPage();
    expect(await screen.findByText(/failed to load addons/i)).toBeInTheDocument();
  });

  it("edits a managed addon via the drawer (version + values → PATCH)", async () => {
    let patchBody: unknown = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.patch("*/api/v1/tenants/acme/addons/addon-cert-manager", async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({
          addon: {
            ...addonsMockControl
              .getState()
              .addons.acme.find((a) => a.id === "addon-cert-manager")!,
            chartVersion: "1.16.1",
          },
          commitSha: "0123456789abcdef0123456789abcdef01234567",
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText("cat-cert-manager")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /^edit$/i }));

    const versionSelect = await screen.findByLabelText(/^version$/i);
    await user.selectOptions(versionSelect, "1.16.1");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(patchBody).toEqual({ chartVersion: "1.16.1" });
    expect(await screen.findByText(/change committed/i)).toBeInTheDocument();

    // the success notice clears when switching tabs (no stale alerts)
    await user.click(screen.getByRole("tab", { name: /discovered/i }));
    await waitFor(() =>
      expect(screen.queryByText(/change committed/i)).not.toBeInTheDocument(),
    );
  });

  it("blocks save when values fail schema validation", async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText("cat-cert-manager")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /^edit$/i }));

    const editor = await screen.findByLabelText(/values \(yaml\)/i);
    await user.clear(editor);
    await user.type(editor, "enableHA: not-a-boolean");

    expect(await screen.findByText(/must be boolean/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("adopts a discovered addon (this cluster via Application)", async () => {
    let adoptBody: unknown = null;
    const { http, HttpResponse } = await import("msw");
    const adoptedRow = () => ({
      ...addonsMockControl
        .getState()
        .addons.acme.find((a) => a.id === "addon-disc-metrics-server")!,
      state: "managed",
    });
    mockServer.use(
      http.post(
        "*/api/v1/tenants/acme/clusters/cl-kind-dev/addons/cat-metrics-server/adopt",
        async ({ request }) => {
          adoptBody = await request.json();
          return HttpResponse.json({
            addon: adoptedRow(),
            commitSha: "0123456789abcdef0123456789abcdef01234567",
          });
        },
      ),
    );

    const user = userEvent.setup();
    renderPage("/acme/clusters/cl-kind-dev/addons?tab=discovered");
    const row = (await screen.findByText("cat-metrics-server")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /adopt into gitops/i }));

    // Baseline repo is preselected; namespace prefilled from the scanner.
    expect(await screen.findByText(/gitops repository/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/namespace/i)).toHaveValue("kube-system");

    const dialog = screen.getByRole("dialog", { name: /adopt addon into gitops/i });
    await user.click(within(dialog).getByRole("button", { name: /^adopt into gitops$/i }));
    await waitFor(() => expect(adoptBody).not.toBeNull());
    expect(adoptBody).toMatchObject({
      repoId: "repo-baseline",
      deployMode: "application",
      namespace: "kube-system",
    });
  });

  it("adopts fleet-wide with a cluster selector and live match preview", async () => {
    let adoptBody: unknown = null;
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.post(
        "*/api/v1/tenants/acme/clusters/cl-kind-dev/addons/cat-metrics-server/adopt",
        async ({ request }) => {
          adoptBody = await request.json();
          return HttpResponse.json({
            addon: {
              ...addonsMockControl
                .getState()
                .addons.acme.find((a) => a.id === "addon-disc-metrics-server")!,
              state: "managed",
            },
            commitSha: "0123456789abcdef0123456789abcdef01234567",
          });
        },
      ),
    );

    const user = userEvent.setup();
    renderPage("/acme/clusters/cl-kind-dev/addons?tab=discovered");
    const row = (await screen.findByText("cat-metrics-server")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /adopt into gitops/i }));

    await screen.findByText(/gitops repository/i);
    await user.click(screen.getByLabelText(/fleet-wide \(applicationset\)/i));

    const dialog = screen.getByRole("dialog", { name: /adopt addon into gitops/i });
    const matchPreview = () =>
      within(dialog).getByText((_, el) =>
        el?.tagName === "P" && /matches \d+ cluster/i.test(el.textContent ?? ""),
      );
    // Empty selector matches all active org clusters (acme seeds two).
    await waitFor(() => expect(matchPreview().textContent).toMatch(/matches 2 clusters/i));

    await user.click(within(dialog).getByRole("button", { name: /add label match/i }));
    await user.selectOptions(within(dialog).getByLabelText(/selector key 1/i), "env");
    await user.type(within(dialog).getByLabelText(/selector value 1/i), "dev");
    await waitFor(() => expect(matchPreview().textContent).toMatch(/matches 1 cluster/i));

    await user.click(within(dialog).getByRole("button", { name: /^adopt into gitops$/i }));
    await waitFor(() => expect(adoptBody).not.toBeNull());
    expect(adoptBody).toMatchObject({
      deployMode: "applicationset",
      clusterSelector: { env: "dev" },
    });
  });

  it("enables prune after a confirmation listing what prune would delete", async () => {
    // Real mock handler (mutates fixture state so the refetch reflects it).
    const pruneRow = () =>
      addonsMockControl.getState().addons.acme.find((a) => a.id === "addon-cert-manager")!;

    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText("cat-cert-manager")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /enable prune/i }));

    // The confirmation lists the ArgoCD app, repo path, and namespace.
    const dialog = screen.getByRole("dialog", { name: /enable prune/i });
    expect(await within(dialog).findByText(/inari-addon-addon-cert-manager/)).toBeInTheDocument();
    expect(within(dialog).getByText("addons/cert-manager")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/deleted from the cluster on the next sync/i),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^enable prune$/i }));
    await waitFor(() => expect(pruneRow().pruneEnabled).toBe(true));
    await waitFor(() => {
      const r = screen.getByText("cat-cert-manager").closest("tr")!;
      expect(within(r).getByText("prune on")).toBeInTheDocument();
    });
  });
});
