import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyPacksPage } from "@/pages/settings/policies/packs";
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
    <MemoryRouter initialEntries={["/acme/settings/policies/packs"]}>
      <Routes>
        <Route path="/:tenant/settings/policies/packs" element={<PolicyPacksPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PolicyPacksPage", () => {
  it("lists org and platform packs", async () => {
    renderPage();
    expect(await screen.findByText("baseline-security")).toBeInTheDocument();
    expect(screen.getByText("platform-guardrails")).toBeInTheDocument();
  });

  it("creates a pack via the inline form", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("baseline-security");
    await user.click(screen.getByRole("button", { name: "New pack" }));
    await user.type(screen.getByLabelText("Name"), "custom-rules");
    await user.type(screen.getByLabelText("Version"), "0.1.0");
    await user.click(screen.getByRole("button", { name: "Create pack" }));
    expect(await screen.findByText("custom-rules")).toBeInTheDocument();
  });

  it("assigns a pack and lists the assignment with a remove action", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("baseline-security");
    await user.click(screen.getAllByRole("button", { name: "Assign" })[0]);
    await user.type(screen.getByLabelText("Target ID"), "cs-prod");
    await user.click(screen.getByRole("button", { name: "Assign pack" }));
    expect(await screen.findByText("clusterset/cs-prod")).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("clusterset/cs-prod")).not.toBeInTheDocument();
  });

  it("hides write controls for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    await screen.findByText("baseline-security");
    expect(screen.queryByRole("button", { name: "New pack" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
