import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { components } from "@/api/__generated__/schema";
import { ObservabilityPlanSection } from "./plan-section";

type Preflight = components["schemas"]["Preflight"];

function fixture(): Preflight {
  return {
    plan: {
      id: "dp-1", orgId: "org-1", orgSlug: "acme-inc", operation: "deploy", state: "preflight",
      source: { kind: "catalog", itemId: "hiroba/payments-api", version: "1.4.0" },
      app: { itemId: "hiroba/payments-api", version: "1.4.0", digest: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" },
      deployment: { targetId: "rt-app", targetRevision: 4, ownerTeam: "payments-api-maintainers" },
      observability: { mode: "provision" }, planFingerprint: "sha256:plan", gate: { companionRendering: false, deployedVerification: false },
      createdAt: "2026-11-15T21:42:00Z", updatedAt: "2026-11-15T21:42:00Z",
      capability: {
        apiVersion: "inari.dev/v1alpha1", kind: "Observability", app: "payments-api", folder: "payments-api",
        datasources: { prometheus: "${DS_PROMETHEUS}" }, linkVariables: ["namespace"],
        dashboards: [{ title: "Service overview", uid: "payments-api-overview", file: "dashboards/overview.json" }],
        rules: [{ file: "rules/availability.yaml", evaluation: "central" }], targets: ["central"], severityRouting: { critical: "platform-security" },
        minimumAppVersion: ">=1.3.0 <2.0.0", observabilityPack: { package: "observability-pack", versionRange: ">=0.2.0 <0.3.0" },
      },
    },
    deploymentTargets: [],
    compatiblePacks: [{ itemId: "hiroba/observability-pack", version: "0.2.0", digest: "sha256:fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210", renderContract: "inari.observability-pack/v2" }],
    monitoringTargets: [{
      id: "rt-mon", orgId: "org-1", name: "Central monitoring", resourceRef: { kind: "cluster", id: "cluster-mon" }, capabilities: ["monitoring.grafana"],
      config: { evaluation: "central", folderPrefixes: ["acme-inc"], datasources: [{ name: "metrics-central", type: "prometheus" }] }, enabled: true, isDefault: true,
      revision: 7, binding: {}, readiness: { state: "ready" }, createdAt: "2026-11-15T21:42:00Z", updatedAt: "2026-11-15T21:42:00Z",
    }],
    providers: [],
  };
}

test("shows exact assets, pins, opt-in copy, and gate without links", () => {
  render(<ObservabilityPlanSection preflight={fixture()} value={{ mode: "provision" }} onChange={() => {}} />);
  screen.getByText("Create a linked companion into an entitled Grafana target.");
  screen.getByText("Service overview");
  screen.getByText("payments-api-overview");
  screen.getByText("inari.observability-pack/v2");
  screen.getByText(/blocked_external_gate|Rendering unavailable|renderer gate/i);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("skip remains available and changes the controlled plan", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ObservabilityPlanSection preflight={fixture()} value={{ mode: "provision" }} onChange={onChange} />);
  await user.click(screen.getByLabelText(/Skip for now/));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: "skip" }));
});

test("no capability and no eligible target use exact non-link states", () => {
  const noCapability = fixture();
  noCapability.plan.capability = undefined;
  const { unmount } = render(<ObservabilityPlanSection preflight={noCapability} value={{ mode: "skip" }} onChange={() => {}} />);
  screen.getByText("This exact app version has no signed observability metadata.");
  unmount();
  const noTarget = fixture();
  noTarget.monitoringTargets = [];
  render(<ObservabilityPlanSection preflight={noTarget} value={{ mode: "provision" }} onChange={() => {}} />);
  screen.getByText(/No eligible monitoring target/);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
