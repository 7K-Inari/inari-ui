import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformAccessPage } from "@/pages/access/platform-access";
import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: {} }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  policyMockControl.reset();
});
beforeEach(() => policyMockControl.reset());
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/platform/access"]}>
      <PlatformAccessPage />
    </MemoryRouter>,
  );
}

describe("PlatformAccessPage", () => {
  it("lists platform admins", async () => {
    renderPage();
    expect(await screen.findByText("Root Admin")).toBeInTheDocument();
    expect(screen.getByText("root@inari.dev")).toBeInTheDocument();
  });

  it("grants a platform admin via PUT", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Root Admin");
    await user.type(
      screen.getByLabelText("Email or user ID"),
      "ops@inari.dev",
    );
    await user.click(screen.getByRole("button", { name: "Grant" }));
    expect((await screen.findAllByText("ops@inari.dev")).length).toBeGreaterThan(0);
    expect(
      policyMockControl.getState().platformAdmins.map((a) => a.userId),
    ).toContain("ops@inari.dev");
  });

  it("revokes a platform admin via DELETE", async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText("Root Admin")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Revoke" }));
    expect(screen.queryByText("Root Admin")).not.toBeInTheDocument();
    expect(policyMockControl.getState().platformAdmins).toHaveLength(0);
  });

  it("renders the server error when listing is forbidden", async () => {
    mockServer.use(
      http.get("*/api/v1/platform/admins", () =>
        HttpResponse.json(
          { title: "Error", status: 403, detail: "forbidden: org_creator required" },
          { status: 403 },
        ),
      ),
    );
    renderPage();
    expect(
      await screen.findByText(/Failed to load platform admins/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email or user ID")).not.toBeInTheDocument();
  });
});
