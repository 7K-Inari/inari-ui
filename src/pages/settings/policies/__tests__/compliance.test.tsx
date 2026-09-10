import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CompliancePage } from "@/pages/settings/policies/compliance";
import { denyDecision, policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: {} }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/acme/settings/policies/compliance"]}>
      <Routes>
        <Route
          path="/:tenant/settings/policies/compliance"
          element={<CompliancePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CompliancePage", () => {
  it("lists active policies", async () => {
    renderPage();
    expect(await screen.findByText("inari.storage/max-size")).toBeInTheDocument();
    expect(screen.getByText("inari.images/approved-registry")).toBeInTheDocument();
    expect(screen.getByText("enabled")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();
  });

  it("runs a dry-run evaluation and renders the decision", async () => {
    const user = userEvent.setup();
    policyMockControl.getState().nextEvaluateDecision = denyDecision;
    renderPage();
    await screen.findByText("inari.storage/max-size");
    await user.type(screen.getByLabelText("Catalog item ID"), "item-1");
    await user.type(screen.getByLabelText("Version"), "1.0.0");
    await user.type(screen.getByLabelText("Cluster ID"), "cl-kind-dev");
    await user.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(await screen.findByText("deny")).toBeInTheDocument();
    expect(screen.getByText(/exceeds tenant quota/)).toBeInTheDocument();
    expect(screen.getByText("Warnings")).toBeInTheDocument();
  });
});
