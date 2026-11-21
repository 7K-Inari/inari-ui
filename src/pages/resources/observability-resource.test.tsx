import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { components } from "@/api/__generated__/schema";
import { ObservabilityResource } from "./observability-resource";

const api = vi.hoisted(() => ({
  getInstanceObservability: vi.fn(),
  preflightDeploymentPlan: vi.fn(),
  submitDeploymentPlan: vi.fn(),
  getDeploymentPlan: vi.fn(),
}));

vi.mock("@/api/deployment-plans", () => api);
vi.mock("@/auth/auth-context", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("@/tenant/tenant-context", () => ({ useTenant: () => ({ tenant: "acme" }) }));

type PlanRequest = components["schemas"]["PlanRequest"];
type Preflight = components["schemas"]["Preflight"];

function fixture(): Preflight {
  const now = "2026-11-15T21:42:00Z";
  return {
    plan: {
      id: "dp-existing", orgId: "org-1", orgSlug: "acme", operation: "provisionExisting",
      source: { kind: "catalog", itemId: "hiroba/payments-api", version: "1.4.0", digest: "sha256:app" },
      deployment: { targetId: "rt-app", targetRevision: 4, ownerTeam: "payments-api-maintainers", spec: {} },
      app: { itemId: "hiroba/payments-api", version: "1.4.0", digest: "sha256:app" },
      observability: {
        mode: "provision",
        pack: { itemId: "hiroba/observability-pack", version: "0.2.0", digest: "sha256:pack", renderContract: "inari.observability-pack/v2" },
        target: { id: "rt-mon", revision: 7, selection: { folder: "acme/payments-api", datasource: "metrics-central", evaluation: "central" } },
      },
      planFingerprint: "sha256:initial", state: "preflight",
      gate: { companionRendering: false, deployedVerification: false }, createdAt: now, updatedAt: now,
      capability: {
        apiVersion: "inari.dev/v1alpha1", kind: "Observability", app: "payments-api", folder: "payments-api",
        datasources: { prometheus: "${DS_PROMETHEUS}" }, dashboards: [{ title: "Overview", uid: "payments-api-overview", file: "dashboards/overview.json" }],
        rules: [{ file: "rules/availability.yaml", evaluation: "central" }], targets: ["central"], severityRouting: { critical: "platform" },
        minimumAppVersion: ">=1.3.0 <2.0.0", observabilityPack: { package: "observability-pack", versionRange: ">=0.2.0 <0.3.0" },
      },
    },
    deploymentTargets: [], providers: [],
    compatiblePacks: [{ itemId: "hiroba/observability-pack", version: "0.2.0", digest: "sha256:pack", renderContract: "inari.observability-pack/v2" }],
    monitoringTargets: [{
      id: "rt-mon", orgId: "org-1", name: "Central", resourceRef: { kind: "cluster", id: "cluster-mon" }, capabilities: ["monitoring.grafana"],
      config: { evaluation: "central", folderPrefixes: ["acme"], datasources: [{ name: "metrics-central", type: "prometheus" }, { name: "metrics-other", type: "prometheus" }] },
      enabled: true, isDefault: true, revision: 7, binding: {}, readiness: { state: "ready" }, createdAt: now, updatedAt: now,
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getInstanceObservability.mockResolvedValue({ mode: "skip", available: true });
  api.preflightDeploymentPlan.mockImplementation(async (_token: string, _tenant: string, body: PlanRequest) => {
    const result = fixture();
    if (body.observability.target || body.observability.mode === "skip") {
      result.plan.observability = body.observability;
    }
    result.plan.planFingerprint = "sha256:fresh";
    return result;
  });
  api.submitDeploymentPlan.mockImplementation(async (_token: string, _tenant: string, body: PlanRequest) => ({
    ...fixture().plan,
    observability: body.observability,
    planFingerprint: body.planFingerprint,
    state: "submitted",
  }));
});

test("existing-instance edits are re-preflighted and submitted with the fresh fingerprint", async () => {
  const user = userEvent.setup();
  render(<ObservabilityResource instanceId="app-1" />);
  await user.click(await screen.findByRole("button", { name: "Provision observability" }));
  const datasource = await screen.findByLabelText("Datasource");
  await user.selectOptions(datasource, "metrics-other");
  await user.click(screen.getByRole("button", { name: "Deploy with observability" }));

  await waitFor(() => expect(api.submitDeploymentPlan).toHaveBeenCalledTimes(1));
  expect(api.preflightDeploymentPlan).toHaveBeenCalledTimes(2);
  const reviewed = api.preflightDeploymentPlan.mock.calls[1][2] as PlanRequest;
  const submitted = api.submitDeploymentPlan.mock.calls[0][2] as PlanRequest;
  expect(reviewed.observability.target?.selection).toMatchObject({ datasource: "metrics-other" });
  expect(submitted.observability).toEqual(reviewed.observability);
  expect(submitted.planFingerprint).toBe("sha256:fresh");
});
