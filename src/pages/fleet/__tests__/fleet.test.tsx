import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { m4MockControl } from "@/mocks/fixtures/m4";
import { mockServer } from "@/mocks/server";
import { FleetOverviewPage } from "@/pages/fleet/fleet-overview";
import { RolloutDetailPage } from "@/pages/fleet/rollout-detail";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m4MockControl.reset();
});
afterAll(() => mockServer.close());

function renderFleet(initialEntry = "/acme/fleet") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:tenant/fleet" element={<FleetOverviewPage />} />
        <Route path="/:tenant/fleet/rollouts/:rolloutId" element={<RolloutDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FleetOverviewPage", () => {
  it("lists ClusterSets with labels and member counts", async () => {
    renderFleet();
    expect(await screen.findByText("prod-eu")).toBeInTheDocument();
    expect(screen.getByText("canary")).toBeInTheDocument();
    expect(screen.getByText("region=eu")).toBeInTheDocument();
    expect(screen.getByText("2 member clusters")).toBeInTheDocument();
  });

  it("creates a ClusterSet via the form", async () => {
    const user = userEvent.setup();
    renderFleet();
    await screen.findByText("prod-eu");
    await user.type(screen.getByLabelText("Name"), "prod-us");
    await user.type(screen.getByLabelText("Targeting labels"), "region=us, env=prod");
    await user.click(screen.getByRole("button", { name: "Create ClusterSet" }));
    expect(await screen.findByText("prod-us")).toBeInTheDocument();
    expect(screen.getByText("region=us")).toBeInTheDocument();
  });

  it("deletes a ClusterSet", async () => {
    const user = userEvent.setup();
    renderFleet();
    await screen.findByText("canary");
    const deletes = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deletes[0]);
    await screen.findByText(/No ClusterSets defined yet|prod-eu/);
    // canary (first card) is gone; prod-eu remains.
    expect(screen.queryByText("canary")).not.toBeInTheDocument();
    expect(screen.getByText("prod-eu")).toBeInTheDocument();
  });

  it("shows active rollouts with state badges", async () => {
    renderFleet("/acme/fleet?tab=rollouts");
    expect(await screen.findByText("cert-manager 1.16 rollout")).toBeInTheDocument();
    expect(screen.getByText("cert-manager@1.16.2")).toBeInTheDocument();
  });

  it("shows drift entries as desired vs reported (report-only)", async () => {
    renderFleet("/acme/fleet?tab=drift");
    expect(await screen.findByText("spec.replicas")).toBeInTheDocument();
    expect(screen.getByText("Deployment/payments-api")).toBeInTheDocument();
    expect(screen.getByText(/report-only in v1/)).toBeInTheDocument();
  });

  it("switches an agent channel", async () => {
    const user = userEvent.setup();
    renderFleet("/acme/fleet?tab=channels");
    expect(await screen.findByText("prod-eu")).toBeInTheDocument();
    const switches = screen.getAllByRole("button", { name: /Switch to/ });
    await user.click(switches[1]);
    // prod-eu flips stable → canary; both rows now show canary.
    await screen.findAllByRole("button", { name: "Switch to stable" });
    expect(screen.getAllByRole("button", { name: "Switch to stable" })).toHaveLength(2);
  });
});

describe("RolloutDetailPage", () => {
  it("shows stage progress live and completes after gate approval", async () => {
    const user = userEvent.setup();
    renderFleet("/acme/fleet/rollouts/ro-1");

    expect(
      await screen.findByRole("heading", { name: "cert-manager 1.16 rollout" }),
    ).toBeInTheDocument();
    expect(screen.getByText("canary")).toBeInTheDocument();

    // Live polling advances the canary stage and opens the wave-1 approval gate.
    const approve = await screen.findByRole("button", { name: "Approve" }, { timeout: 10_000 });
    expect(screen.getByText(/waiting-approval/)).toBeInTheDocument();

    await user.click(approve);
    expect(await screen.findByText("completed", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText("3/3 clusters healthy")).toBeInTheDocument();
  }, 20_000);

  it("supports rollback", async () => {
    const user = userEvent.setup();
    renderFleet("/acme/fleet/rollouts/ro-1");
    await screen.findByRole("heading", { name: "cert-manager 1.16 rollout" });
    await user.click(screen.getByRole("button", { name: "Roll back" }));
    expect(await screen.findByText("rolled-back")).toBeInTheDocument();
  });
});
