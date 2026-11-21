import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { mockControl } from "@/mocks/fixtures";
import { mockCatalogControl } from "@/mocks/fixtures/catalog";
import { gitReposMockControl } from "@/mocks/fixtures/git-repos";
import { mockServer } from "@/mocks/server";
import { ResourceDetailPage } from "@/pages/resources/resource-detail";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  mockControl.reset();
  mockCatalogControl.reset();
  gitReposMockControl.reset();
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

  it("shows the verification gate without policy or fabricated links", async () => {
    renderPage();
    expect(await screen.findByText("Environment verification")).toBeInTheDocument();
    expect(await screen.findByText(/Workflow rendering and deployed runs are stopped/)).toBeInTheDocument();
    expect(screen.getByText(/No verification policy is configured/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open logs/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open artifacts/ })).not.toBeInTheDocument();
  });

  it("requests a fresh server-derived spec digest on policy preview", async () => {
    const user = userEvent.setup();
    const { http, HttpResponse } = await import("msw");
    const captured: { policy?: { binding?: { specDigest?: string } } } = {};
    mockServer.use(http.post("*/api/v1/tenants/acme/instances/:id/verification/preview", async ({ request }) => {
      captured.policy = await request.json() as NonNullable<typeof captured.policy>;
      return HttpResponse.json({ policy: captured.policy, gate: { renderAvailable: false, deployedVerification: false }, sideEffectsPerformed: 0 });
    }));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Configure verification" }));
    await user.type(screen.getByLabelText("Platform suite grant ID"), "vsg-1");
    await user.type(screen.getByLabelText("Exact suite digest"), "sha256:suite");
    await user.click(screen.getByRole("button", { name: "Preview policy" }));
    expect(await screen.findByText(/Preview completed with zero side effects/)).toBeInTheDocument();
    expect(captured.policy?.binding?.specDigest).toBe("");
  });

  it("keeps failed verification separate and renders no run links", async () => {
    const { http, HttpResponse } = await import("msw");
    const policy = {
      policyRevision: 1, enabled: true,
      binding: { appItemId: "hiroba/example", appVersion: "1.3.0", appArtifactDigest: "sha256:app", specDigest: "sha256:spec", suiteGrantId: "vsg-1", suiteDigest: "sha256:suite", profile: "stage", parameterContract: "inari.smoke.params.v1" },
      triggers: { onRevisionChange: { enabled: true }, onSync: { enabled: false }, manual: { enabled: true }, cron: { enabled: false } },
      timeout: "10m", concurrency: { maxActive: 1, maxPending: 1, queuedRevisionPolicy: "latestOnly" },
      retention: { workflowTTLSeconds: 3600, successfulHistory: 3, failedHistory: 3, resultDays: 30 },
      addonAbsent: "block", failureAction: "pausePromotion",
    };
    const run = {
      runId: "vr-failed", runKey: "sha256:key", orgId: "org:acme", instanceId: "ri-orders-db", instanceUid: "uid",
      appRevision: "sha256:revision", appArtifactDigest: "sha256:app", suiteDigest: "sha256:suite", profile: "stage",
      trigger: { kind: "manual", profile: "stage", requestKey: "req" }, triggerFingerprint: "sha256:trigger",
      status: "failed", reasonCode: "workflow_failed", policyRevision: 1, grantRevision: 1, latestAttempt: 1,
      createdAt: "2026-11-21T01:00:00Z", updatedAt: "2026-11-21T01:00:00Z",
    };
    mockServer.use(http.get("*/api/v1/tenants/acme/instances/:id/verification", () => HttpResponse.json({
      gate: { renderAvailable: false, deployedVerification: false, reason: "sibling_8f8c472a_phase_3_unconfirmed" }, policy, runs: [run],
    })));
    renderPage();
    expect(await screen.findByText("workflow_failed", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/No automatic rollback was performed/)).toBeInTheDocument();
    expect(screen.getByText(/No current Workflow log or artifact links/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open logs/ })).not.toBeInTheDocument();
  });

  it("shows the GitOps repo card with commit and PR links", async () => {
    renderPage();
    expect(await screen.findByText("GitOps Repository")).toBeInTheDocument();
    expect(screen.getByText("baseline")).toBeInTheDocument();
    expect(screen.getByText("acme/acme-inari-state")).toBeInTheDocument();
    expect(screen.getByText(/Direct/)).toBeInTheDocument();
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
    const item = findCatalogItem("core/postgresql-aws")!;
    mockServer.use(
      http.get("*/api/v1/tenants/acme/catalog/:source/:name", () =>
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
