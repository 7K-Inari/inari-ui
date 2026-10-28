import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GitSettingsPage } from "@/pages/settings/org/git";
import { gitReposMockControl } from "@/mocks/fixtures/git-repos";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

let mockParsedToken: Record<string, unknown> | undefined = {
  organization: { acme: { name: "Acme", roles: ["admin"] } },
};
vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: mockParsedToken }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
  gitReposMockControl.reset();
});
beforeEach(() => {
  mockParsedToken = { organization: { acme: { name: "Acme", roles: ["admin"] } } };
  policyMockControl.reset();
  gitReposMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/acme/settings/org/git"]}>
      <Routes>
        <Route path="/:tenant/settings/org/git" element={<GitSettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GitSettingsPage (repo registry)", () => {
  it("lists the org's git repos with scope/policy/default badges", async () => {
    renderPage();
    expect(await screen.findByText("baseline")).toBeInTheDocument();
    expect(screen.getByText("team-alpha-gitops")).toBeInTheDocument();
    expect(screen.getByText("team-beta-gitops")).toBeInTheDocument();
    // Default badge on baseline
    const baselineRow = screen.getByText("baseline").closest("tr")!;
    expect(within(baselineRow).getByText(/default/i)).toBeInTheDocument();
    // Scope badges
    expect(within(baselineRow).getByText(/platform/i)).toBeInTheDocument();
  });

  it("shows the org defaults card with commit policy and scaffold git org", async () => {
    renderPage();
    expect(await screen.findByText(/org defaults/i)).toBeInTheDocument();
    expect(screen.getByText(/commit policy default/i)).toBeInTheDocument();
    expect(screen.getByText(/scaffold git org/i)).toBeInTheDocument();
  });

  it("has a New GitOps Repo button linking to the scaffold wizard route", async () => {
    renderPage();
    const cta = await screen.findByRole("link", { name: /new gitops repo/i });
    expect(cta).toHaveAttribute("href", "/acme/settings/org/git/new");
  });

  it("opens the register-existing modal", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("baseline");
    await user.click(screen.getByRole("button", { name: /register existing/i }));
    expect(await screen.findByText(/register existing repository/i)).toBeInTheDocument();
  });

  it("registers a new repo via the modal", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("baseline");
    await user.click(screen.getByRole("button", { name: /register existing/i }));
    await user.type(screen.getByLabelText(/display name/i), "team-gamma-gitops");
    await user.type(screen.getByLabelText(/^repository/i), "acme/team-gamma-gitops");
    await user.selectOptions(screen.getByLabelText(/owning team/i), "team-platform");
    await user.click(screen.getByRole("button", { name: /^register repo$/i }));
    await waitFor(() =>
      expect(screen.getByText("team-gamma-gitops")).toBeInTheDocument(),
    );
  });

  it("opens the per-repo drawer on row click and patches the policy", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("baseline");
    await user.click(screen.getByText("team-beta-gitops"));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText(/repository settings/i)).toBeInTheDocument();
    // Change commit policy to pull_request
    await user.selectOptions(
      within(drawer).getByLabelText(/commit policy/i),
      "pull_request",
    );
    await user.click(within(drawer).getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      const repos = gitReposMockControl.getState().repos.acme;
      expect(repos.find((r) => r.name === "team-beta-gitops")?.commitPolicy).toBe(
        "pull_request",
      );
    });
  });

  it("opens the delete modal in blocked variant when refs exist", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("baseline");
    await user.click(screen.getByText("team-alpha-gitops"));
    const drawer = await screen.findByRole("dialog");
    await user.click(within(drawer).getByRole("button", { name: /delete repo/i }));
    // Choose orphan and attempt delete — server returns 409
    const modal = await screen.findByRole("dialog", { name: /delete repository/i });
    await user.click(within(modal).getByRole("radio", { name: /orphan/i }));
    await user.click(within(modal).getByRole("button", { name: /^delete repo$/i }));
    expect(await screen.findByText(/cannot delete repository/i)).toBeInTheDocument();
    expect(screen.getByText(/repo in use by 5 workload/i)).toBeInTheDocument();
  });

  it("deletes a repo with force+mode=orphan after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("baseline");
    await user.click(screen.getByText("team-alpha-gitops"));
    const drawer = await screen.findByRole("dialog");
    await user.click(within(drawer).getByRole("button", { name: /delete repo/i }));
    // First attempt: orphan without force → blocked
    const modal = await screen.findByRole("dialog", { name: /delete repository/i });
    await user.click(within(modal).getByRole("radio", { name: /orphan/i }));
    await user.click(within(modal).getByRole("button", { name: /^delete repo$/i }));
    expect(await screen.findByText(/cannot delete repository/i)).toBeInTheDocument();
    // Dismiss blocked, then retry with force (the modal now sends force=true)
    await user.click(screen.getByRole("button", { name: /understood/i }));
    // The modal is still open with the repo; click delete again — this time
    // the modal should include force=true because we've seen the blocked warning.
    const modal2 = await screen.findByRole("dialog", { name: /delete repository/i });
    await user.click(within(modal2).getByRole("button", { name: /^delete repo$/i }));
    await waitFor(() => {
      const repos = gitReposMockControl.getState().repos.acme;
      expect(repos.some((r) => r.name === "team-alpha-gitops")).toBe(false);
    });
  });

  it("shows an empty state when no repos are registered", async () => {
    // globex has no repos — render with a different tenant mock.
    const tenantModule = await import("@/tenant/tenant-context");
    vi.spyOn(tenantModule, "useTenant").mockReturnValue({ tenant: "globex" } as never);
    render(
      <MemoryRouter initialEntries={["/globex/settings/org/git"]}>
        <Routes>
          <Route path="/:tenant/settings/org/git" element={<GitSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no repositories registered/i)).toBeInTheDocument();
  });
});
