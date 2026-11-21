import { render, screen } from "@testing-library/react";
import type { components } from "@/api/__generated__/schema";
import { CompanionCard } from "./companion-card";

type Companion = components["schemas"]["Companion"];
type InstanceObservability = components["schemas"]["InstanceObservability"];

function companion(state: string): Companion {
  return {
    id: "oc-1", planId: "dp-1", appInstanceId: "app-1", appRevision: "1.4.0@sha256:abc", appSourceDigest: "sha256:abc",
    capabilityDigest: "sha256:cap", generation: 3, targetId: "rt-mon", targetRevision: 7, targetClusterId: "cluster-mon", targetSelection: {},
    pack: { itemId: "hiroba/observability-pack", version: "0.2.0", digest: "sha256:pack", renderContract: "inari.observability-pack/v2" },
    state, links: [], createdAt: "2026-11-15T21:42:00Z", updatedAt: "2026-11-15T21:42:00Z",
  };
}

function status(companionValue?: Companion): InstanceObservability {
  return { mode: companionValue ? "provision" : "skip", available: true, companion: companionValue };
}

test("non-ready states expose LINKS 0 and no Grafana anchors", () => {
  for (const state of ["blocked_external_gate", "approval_pending", "waiting_for_app", "render_pending", "deploying", "verification_pending", "verification_failed", "unavailable", "cancelled"]) {
    const { unmount } = render(<CompanionCard status={status(companion(state))} />);
    screen.getByText("LINKS 0");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    unmount();
  }
});

test("ready renders only unchanged server-provided URLs", () => {
  const ready = companion("ready");
  ready.links = [{ title: "Service overview", uid: "payments-api-overview", url: "https://grafana.team.example/d/payments-api-overview/overview?var-namespace=payments" }];
  render(<CompanionCard status={status(ready)} />);
  const link = screen.getByRole("link", { name: "Open Service overview on Grafana (new tab)" });
  expect(link).toHaveAttribute("href", "https://grafana.team.example/d/payments-api-overview/overview?var-namespace=payments");
  expect(link).toHaveAttribute("target", "_blank");
  expect(screen.queryByText("LINKS 0")).not.toBeInTheDocument();
});

test("skip offers later provision and none has no action", () => {
  const { unmount } = render(<CompanionCard status={status()} onProvision={() => {}} />);
  screen.getByRole("button", { name: "Provision observability" });
  unmount();
  render(<CompanionCard status={{ mode: "none", available: false, reason: "This exact app version has no signed observability metadata." }} onProvision={() => {}} />);
  screen.getByText("This exact app version has no signed observability metadata.");
  expect(screen.queryByRole("button", { name: "Provision observability" })).not.toBeInTheDocument();
});
