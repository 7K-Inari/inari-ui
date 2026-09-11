import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OrgProfilePage } from "@/pages/settings/org/org-profile";
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
    <MemoryRouter initialEntries={["/acme/settings/org"]}>
      <Routes>
        <Route path="/:tenant/settings/org" element={<OrgProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OrgProfilePage", () => {
  it("loads and displays the organization", async () => {
    renderPage();
    expect(await screen.findByLabelText("Display name")).toHaveValue("Acme Corp");
    expect(screen.getByLabelText("Slug")).toHaveValue("acme");
    expect(screen.getByLabelText("Slug")).toBeDisabled();
  });

  it("saves the display name via PATCH", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Acme Industries");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Organization profile saved.")).toBeInTheDocument();
    expect(policyMockControl.getState().orgs.acme.displayName).toBe("Acme Industries");
  });

  it("renders read-only for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    expect(await screen.findByLabelText("Display name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
