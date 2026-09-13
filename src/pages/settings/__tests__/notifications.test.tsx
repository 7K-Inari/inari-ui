import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { policyMockControl } from "@/mocks/fixtures/m6";
import { mockServer } from "@/mocks/server";
import { NotificationsPage } from "@/pages/settings/notifications";

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
  vi.restoreAllMocks();
});
beforeEach(() => {
  mockParsedToken = { organization: { acme: { name: "Acme", roles: ["admin"] } } };
  policyMockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/acme/settings/notifications"]}>
      <Routes>
        <Route
          path="/:tenant/settings/notifications"
          element={<NotificationsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NotificationsPage", () => {
  it("lists endpoints with kind badge, masked URL, and event chips", async () => {
    renderPage();
    expect(await screen.findByText("ops-slack")).toBeInTheDocument();
    expect(screen.getByText("audit-webhook")).toBeInTheDocument();
    expect(screen.getByText("slack")).toBeInTheDocument();
    expect(screen.getByText("webhook")).toBeInTheDocument();
    // URL masked to origin; the full URL (with secret path) appears nowhere,
    // including the title attribute.
    const masked = screen.getByText("https://hooks.slack.com/•••");
    expect(masked).toHaveAttribute("title", "https://hooks.slack.com/•••");
    expect(masked.getAttribute("title")).not.toContain("secret-token");
    expect(
      screen.queryByText(/secret-token/, { selector: "td" }),
    ).not.toBeInTheDocument();
    // Event filter chips + "All events" for an unfiltered endpoint.
    expect(screen.getByText("Approval requested")).toBeInTheDocument();
    expect(screen.getByText("Approval decided")).toBeInTheDocument();
    expect(screen.getByText("All events")).toBeInTheDocument();
    // Enabled states.
    const slackRow = screen.getByText("ops-slack").closest("tr")!;
    expect(within(slackRow).getByRole("checkbox")).toBeChecked();
    const hookRow = screen.getByText("audit-webhook").closest("tr")!;
    expect(within(hookRow).getByRole("checkbox")).not.toBeChecked();
  });

  it("shows an empty state with a create CTA when no endpoints exist", async () => {
    const user = userEvent.setup();
    policyMockControl.getState().notificationEndpoints.acme = [];
    renderPage();
    const cta = await screen.findByRole("button", {
      name: "Create your first endpoint",
    });
    await user.click(cta);
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
  });

  it("creates an endpoint and refreshes the list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    await user.click(screen.getByRole("button", { name: "New endpoint" }));
    await user.type(screen.getByLabelText(/^Name/), "alerts-hook");
    await user.click(screen.getByRole("radio", { name: "Webhook" }));
    await user.type(
      screen.getByLabelText(/^URL/),
      "https://webhook.site/abcd",
    );
    await user.click(screen.getByRole("button", { name: "Deploy requested" }));
    await user.click(screen.getByRole("button", { name: "Create endpoint" }));
    expect(await screen.findByText("alerts-hook")).toBeInTheDocument();
    const created = policyMockControl
      .getState()
      .notificationEndpoints.acme.find((e) => e.name === "alerts-hook");
    expect(created?.kind).toBe("webhook");
    expect(created?.events).toEqual(["deploy.requested"]);
    expect(created?.enabled).toBe(true);
    // No secret key sent when the field is blank.
    expect(created && "secret" in created).toBe(false);
  });

  it("blocks a non-http(s) URL client-side", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    await user.click(screen.getByRole("button", { name: "New endpoint" }));
    await user.type(screen.getByLabelText(/^Name/), "bad-url");
    await user.type(screen.getByLabelText(/^URL/), "ftp://example.com/hook");
    await user.click(screen.getByRole("button", { name: "Create endpoint" }));
    expect(
      await screen.findByText(/must be an http\(s\) URL/),
    ).toBeInTheDocument();
    expect(
      policyMockControl.getState().notificationEndpoints.acme,
    ).toHaveLength(2);
  });

  it("surfaces a server 422 detail inline", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.post("*/api/v1/tenants/:org/notification-endpoints", () =>
        HttpResponse.json(
          { title: "Error", status: 422, detail: "slack webhook URL is invalid" },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    await user.click(screen.getByRole("button", { name: "New endpoint" }));
    await user.type(screen.getByLabelText(/^Name/), "x");
    await user.type(screen.getByLabelText(/^URL/), "https://hooks.slack.com/x");
    await user.click(screen.getByRole("button", { name: "Create endpoint" }));
    expect(
      await screen.findByText(/slack webhook URL is invalid/),
    ).toBeInTheDocument();
  });

  it("edits an endpoint without sending kind or a blank secret", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    const row = screen.getByText("ops-slack").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    // Kind picker is disabled in edit mode.
    expect(screen.getByRole("radio", { name: "Slack" })).toBeDisabled();
    const url = screen.getByLabelText(/^URL/);
    await user.clear(url);
    await user.type(url, "https://hooks.slack.com/services/NEW");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("ops-slack");
    const updated = policyMockControl
      .getState()
      .notificationEndpoints.acme.find((e) => e.id === "ne-slack-ops");
    expect(updated?.url).toBe("https://hooks.slack.com/services/NEW");
    expect(updated?.kind).toBe("slack");
  });

  it("toggles enabled via the row switch", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    const row = screen.getByText("ops-slack").closest("tr")!;
    await user.click(within(row).getByRole("checkbox"));
    const updated = policyMockControl
      .getState()
      .notificationEndpoints.acme.find((e) => e.id === "ne-slack-ops");
    expect(updated?.enabled).toBe(false);
  });

  it("sends a test notification and shows the delivery result", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    const row = screen.getByText("ops-slack").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Send test" }));
    expect(await within(row).findByText(/delivered/i)).toBeInTheDocument();
  });

  it("shows the failure detail when a test delivery fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.post("*/api/v1/tenants/:org/notification-endpoints/:id/test", () =>
        HttpResponse.json({
          delivery: {
            id: "nd-1",
            endpointId: "ne-slack-ops",
            eventType: "notification.test",
            payload: {},
            status: "failed",
            attempts: 1,
            lastError: "slack post: unexpected status 404",
            createdAt: new Date().toISOString(),
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    const row = screen.getByText("ops-slack").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Send test" }));
    expect(
      await within(row).findByText(/unexpected status 404/),
    ).toBeInTheDocument();
  });

  it("deletes an endpoint after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    const row = screen.getByText("ops-slack").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    expect(
      policyMockControl
        .getState()
        .notificationEndpoints.acme.some((e) => e.id === "ne-slack-ops"),
    ).toBe(false);
  });

  it("keeps the endpoint when confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ops-slack");
    const row = screen.getByText("ops-slack").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    expect(
      policyMockControl
        .getState()
        .notificationEndpoints.acme.some((e) => e.id === "ne-slack-ops"),
    ).toBe(true);
  });

  it("hides write controls for an org viewer", async () => {
    mockParsedToken = {};
    renderPage();
    await screen.findByText("ops-slack");
    expect(
      screen.queryByRole("button", { name: "New endpoint" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send test" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Read-only (org viewer)")).toBeInTheDocument();
  });

  it("notes that delivery history is not exposed by the API yet", async () => {
    renderPage();
    await screen.findByText("ops-slack");
    expect(
      screen.getByText(/delivery history is not exposed/i),
    ).toBeInTheDocument();
  });

  it("surfaces a list failure", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/:org/notification-endpoints", () =>
        HttpResponse.json(
          { title: "Error", status: 500, detail: "boom" },
          { status: 500 },
        ),
      ),
    );
    renderPage();
    expect(
      await screen.findByText(/Failed to load notification endpoints/),
    ).toBeInTheDocument();
  });
});
