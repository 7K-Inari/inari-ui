import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GitSettingsPage } from "@/pages/settings/org/git";
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
    <MemoryRouter initialEntries={["/acme/settings/org/git"]}>
      <Routes>
        <Route path="/:tenant/settings/org/git" element={<GitSettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GitSettingsPage", () => {
  it("loads and displays the current git config", async () => {
    renderPage();
    expect(await screen.findByLabelText("Repository")).toHaveValue(
      "acme/acme-inari-state",
    );
    expect(screen.getByLabelText("Base branch")).toHaveValue("main");
    expect(screen.getByLabelText("Commit policy")).toHaveValue("pull_request");
  });

  it("saves changes via PUT", async () => {
    const user = userEvent.setup();
    renderPage();
    const repo = await screen.findByLabelText("Repository");
    await user.clear(repo);
    await user.type(repo, "acme/state-v2");
    await user.selectOptions(screen.getByLabelText("Commit policy"), "direct");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Git config saved.")).toBeInTheDocument();
    expect(policyMockControl.getState().gitConfigs.acme.repo).toBe("acme/state-v2");
    expect(policyMockControl.getState().gitConfigs.acme.commitPolicy).toBe("direct");
  });

  it("renders the form read-only for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    expect(await screen.findByLabelText("Repository")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
