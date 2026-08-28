import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ClusterDetailPage } from "@/pages/clusters/cluster-detail";
import { mockControl } from "@/mocks/fixtures";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
beforeEach(() => mockControl.reset());
afterAll(() => mockServer.close());

function renderDetail(id = "cl-kind-dev", query = "") {
  return render(
    <MemoryRouter initialEntries={[`/acme/clusters/${id}${query}`]}>
      <Routes>
        <Route path="/:tenant/clusters/:clusterId" element={<ClusterDetailPage />} />
        <Route path="/:tenant/clusters" element={<p>cluster list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ClusterDetailPage", () => {
  it("shows cluster header with status and labels", async () => {
    renderDetail();
    expect(await screen.findByRole("heading", { name: "kind-dev" })).toBeInTheDocument();
    expect(screen.getByTestId("status-connected")).toBeInTheDocument();
    expect(screen.getByText("cloud=kind")).toBeInTheDocument();
  });

  it("groups discovered capabilities by kind with management mode badges", async () => {
    renderDetail();
    expect(await screen.findByText(/Operators \(OLM\)/)).toBeInTheDocument();
    expect(screen.getByText(/Crossplane Providers/)).toBeInTheDocument();
    expect(screen.getByText(/Crossplane XRDs/)).toBeInTheDocument();
    expect(screen.getByText(/Helm Releases/)).toBeInTheDocument();
    expect(screen.getByText(/KRO ResourceGraphDefinitions/)).toBeInTheDocument();
    expect(screen.getByText(/Custom Resource Definitions/)).toBeInTheDocument();
    expect(screen.getByText("certificates.cert-manager.io")).toBeInTheDocument();
    expect(screen.getByText("provider-aws-s3")).toBeInTheDocument();
    expect(screen.getAllByText("adopt").length).toBe(3);
    expect(screen.getAllByText("observe").length).toBe(4);
    expect(screen.getAllByText("ignore").length).toBe(1);
  });

  it("defaults to the capabilities tab", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "kind-dev" });
    expect(screen.getByRole("tab", { name: "Capabilities" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("filters capabilities by search", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText("certificates.cert-manager.io");
    await user.type(screen.getByLabelText("Filter capabilities"), "argoproj");
    expect(screen.queryByText("certificates.cert-manager.io")).not.toBeInTheDocument();
    expect(screen.getByText("applications.argoproj.io")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is discovered yet", async () => {
    renderDetail("cl-eks-prod");
    expect(await screen.findByText(/No capabilities discovered yet/)).toBeInTheDocument();
  });

  it("switches to the overview tab with versions and timestamps", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole("heading", { name: "kind-dev" });
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    const main = screen.getByRole("tab", { name: "Overview" }).parentElement!.parentElement!;
    expect(within(main).getByText("Agent version")).toBeInTheDocument();
    expect(screen.getByText("0.3.1")).toBeInTheDocument();
    expect(screen.getByText("v1.30.2")).toBeInTheDocument();
  });

  it("honors ?tab=overview in the URL", async () => {
    renderDetail("cl-kind-dev", "?tab=overview");
    await screen.findByRole("heading", { name: "kind-dev" });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows an error with a back link for unknown clusters", async () => {
    renderDetail("cl-nope");
    expect(await screen.findByText(/cluster not found/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to clusters" })).toHaveAttribute(
      "href",
      "/acme/clusters",
    );
  });

  it("shows resume and cancel actions for pending clusters", async () => {
    mockControl.setClusterStatus("cl-eks-prod", "pending");
    renderDetail("cl-eks-prod");
    await screen.findByRole("heading", { name: "eks-prod-eu" });
    expect(screen.getByRole("link", { name: "Resume registration" })).toHaveAttribute(
      "href",
      "/acme/clusters/new?cluster=cl-eks-prod",
    );
    expect(screen.getByRole("button", { name: "Cancel registration" })).toBeInTheDocument();
  });

  it("hides registration actions for connected clusters", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "kind-dev" });
    expect(
      screen.queryByRole("link", { name: "Resume registration" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel registration" }),
    ).not.toBeInTheDocument();
  });

  it("cancels a pending registration and navigates back to the list", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockControl.setClusterStatus("cl-eks-prod", "pending");
    renderDetail("cl-eks-prod");
    await screen.findByRole("heading", { name: "eks-prod-eu" });
    await user.click(screen.getByRole("button", { name: "Cancel registration" }));
    expect(await screen.findByText("cluster list")).toBeInTheDocument();
    expect(mockControl.getState().clusters.map((c) => c.id)).not.toContain("cl-eks-prod");
    vi.restoreAllMocks();
  });

  it("surfaces API errors when cancelling fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.delete("*/api/v1/tenants/acme/clusters/:id", () =>
        HttpResponse.json({ detail: "forbidden" }, { status: 403 }),
      ),
    );
    mockControl.setClusterStatus("cl-eks-prod", "pending");
    renderDetail("cl-eks-prod");
    await screen.findByRole("heading", { name: "eks-prod-eu" });
    await user.click(screen.getByRole("button", { name: "Cancel registration" }));
    expect(await screen.findByText(/forbidden/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
