import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import type { components } from "@/api/__generated__/schema";
import { DirectChartWizardPage } from "./direct-chart-wizard";

const api = vi.hoisted(() => ({
  listCatalogItems: vi.fn(),
  listTeams: vi.fn(),
  preflightDeploymentPlan: vi.fn(),
  submitDeploymentPlan: vi.fn(),
}));

vi.mock("@/api/catalog", () => ({ listCatalogItems: api.listCatalogItems }));
vi.mock("@/api/tenants", () => ({ listTeams: api.listTeams }));
vi.mock("@/api/deployment-plans", () => ({
  preflightDeploymentPlan: api.preflightDeploymentPlan,
  submitDeploymentPlan: api.submitDeploymentPlan,
}));
vi.mock("@/auth/auth-context", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("@/tenant/tenant-context", () => ({ useTenant: () => ({ tenant: "acme" }) }));

type PlanRequest = components["schemas"]["PlanRequest"];
type Preflight = components["schemas"]["Preflight"];

const appDigest = "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const packDigest = "sha256:fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

function preflightFor(body: PlanRequest): Preflight {
  const now = "2026-11-15T21:42:00Z";
  const source = { ...body.source!, version: "1.4.0", digest: appDigest };
  const pack = { itemId: "hiroba/observability-pack", sourceId: "hiroba", version: "0.2.0", digest: packDigest, renderContract: "inari.observability-pack/v2" };
  const target = { id: "rt-mon", revision: 7, selection: { folder: "acme/payments-api", datasource: "metrics-central", evaluation: "central" } };
  const observability = body.observability.mode === "provision" ? { mode: "provision" as const, pack, target } : { mode: "skip" as const };
  return {
    plan: {
      id: "dp-chart", orgId: "org-1", orgSlug: "acme", operation: "deploy", state: "preflight",
      source, deployment: body.deployment,
      app: { itemId: "hiroba/payments-api", sourceId: "hiroba", version: "1.4.0", digest: appDigest, chartDigest: appDigest },
      observability, planFingerprint: "sha256:reviewed-chart", gate: { companionRendering: false, deployedVerification: false }, createdAt: now, updatedAt: now,
      capability: {
        apiVersion: "inari.dev/v1alpha1", kind: "Observability", app: "payments-api", folder: "payments-api",
        datasources: { prometheus: "${DS_PROMETHEUS}" }, linkVariables: ["namespace"],
        dashboards: [{ title: "Service overview", uid: "payments-api-overview", file: "dashboards/overview.json" }],
        rules: [{ file: "rules/availability.yaml", evaluation: "central" }], targets: ["central"], severityRouting: { critical: "platform" },
        minimumAppVersion: ">=1.3.0 <2.0.0", observabilityPack: { package: "observability-pack", versionRange: ">=0.2.0 <0.3.0" },
      },
    },
    schema: { type: "object" }, uiHints: {}, providers: [], compatiblePacks: [pack],
    deploymentTargets: [{
      id: "rt-app", orgId: "org-1", name: "Production", resourceRef: { kind: "cluster", id: "cluster-app" }, capabilities: ["deployment.cluster"],
      config: {}, enabled: true, isDefault: false, revision: 4, binding: {}, readiness: { state: "ready" }, createdAt: now, updatedAt: now,
    }],
    monitoringTargets: [{
      id: "rt-mon", orgId: "org-1", name: "Central", resourceRef: { kind: "cluster", id: "cluster-mon" }, capabilities: ["monitoring.grafana"],
      config: { evaluation: "central", folderPrefixes: ["acme"], datasources: [{ name: "metrics-central", type: "prometheus" }] },
      enabled: true, isDefault: true, revision: 7, binding: {}, readiness: { state: "ready" }, createdAt: now, updatedAt: now,
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listCatalogItems.mockResolvedValue({ items: [{ sourceId: "hiroba" }] });
  api.listTeams.mockResolvedValue([]);
  api.preflightDeploymentPlan.mockImplementation(async (_token: string, _tenant: string, body: PlanRequest) => preflightFor(body));
  api.submitDeploymentPlan.mockImplementation(async (_token: string, _tenant: string, body: PlanRequest) => ({
    ...preflightFor(body).plan,
    id: "dp-chart-submitted",
    state: "submitted",
    appInstanceId: "app-1",
    deployment: body.deployment,
    observability: body.observability,
    planFingerprint: body.planFingerprint!,
  }));
});

test("direct chart uses normalized exact pins through review and submit", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><DirectChartWizardPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByLabelText("Trusted source")).toHaveValue("hiroba"));
  await user.type(screen.getByLabelText("OCI repository (no tag)"), "oci://ghcr.io/7k-hiroba/payments-api/charts/payments-api");
  await user.type(screen.getByLabelText("Exact chart version"), "1.4.0");
  await user.type(screen.getByLabelText("SHA-256 digest"), appDigest);
  await user.click(screen.getByRole("button", { name: "Check exact chart" }));
  expect(await screen.findByText("Service overview")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Grafana/ })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Instance name"), "payments");
  await user.selectOptions(screen.getByLabelText("Target cluster"), "rt-app");
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByRole("heading", { name: "Review" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Deploy application" }));
  expect(await screen.findByText("Deploy status")).toBeInTheDocument();
  const submitted = api.submitDeploymentPlan.mock.calls[0][2] as PlanRequest;
  expect(submitted.source).toMatchObject({ kind: "chart", version: "1.4.0", digest: appDigest });
  expect(submitted.deployment).toMatchObject({ targetId: "rt-app", targetRevision: 4, name: "payments" });
  expect(submitted.observability.mode).toBe("skip");
  expect(submitted.planFingerprint).toBe("sha256:reviewed-chart");
});
