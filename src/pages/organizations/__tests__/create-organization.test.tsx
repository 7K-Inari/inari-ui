import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateOrganizationPage } from "@/pages/organizations/create-organization";
import { mockServer } from "@/mocks/server";

let mockParsedToken: Record<string, unknown> | undefined;
vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: mockParsedToken }),
}));

const updateToken = vi.fn().mockResolvedValue(true);
vi.mock("@/auth/keycloak", () => ({
  keycloak: { updateToken: (...args: unknown[]) => updateToken(...args) },
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

beforeEach(() => {
  mockParsedToken = { realm_access: { roles: ["platform-admin"] } };
  updateToken.mockClear();
});

function OverviewStub() {
  const { tenant } = useParams();
  return <div>overview {tenant}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/create-organization"]}>
      <Routes>
        <Route path="/create-organization" element={<CreateOrganizationPage />} />
        <Route path="/:tenant/overview" element={<OverviewStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CreateOrganizationPage", () => {
  it("denies access to non platform admins", () => {
    mockParsedToken = { realm_access: { roles: ["developer"] } };
    renderPage();
    expect(screen.getByRole("heading", { name: /not authorized/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Slug")).not.toBeInTheDocument();
  });

  it("validates the slug format client-side and does not call the API", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Display name"), "Bad Org");
    await user.type(screen.getByLabelText("Slug"), "Bad_Slug");
    await user.click(screen.getByRole("button", { name: /create organization/i }));
    expect(
      await screen.findByText(/lowercase letters, numbers, and dashes/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^overview /)).not.toBeInTheDocument();
  });

  it("creates the organization and navigates to its overview", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Display name"), "Initech");
    await user.type(screen.getByLabelText("Slug"), "initech");
    await user.click(screen.getByRole("button", { name: /create organization/i }));
    expect(await screen.findByText("overview initech")).toBeInTheDocument();
    await waitFor(() => expect(updateToken).toHaveBeenCalled());
  });

  it("shows a conflict message when the slug already exists and re-enables the form", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Display name"), "Taken Inc");
    await user.type(screen.getByLabelText("Slug"), "taken");
    await user.click(screen.getByRole("button", { name: /create organization/i }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create organization/i })).toBeEnabled();
    expect(screen.queryByText(/^overview /)).not.toBeInTheDocument();
  });

  it("shows a generic error and loading state on failure", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.post("*/api/v1/tenants", () =>
        HttpResponse.json({ title: "Error", status: 500, detail: "boom" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Display name"), "Initech");
    await user.type(screen.getByLabelText("Slug"), "initech");
    const submit = screen.getByRole("button", { name: /create organization/i });
    await user.click(submit);
    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create organization/i })).toBeEnabled();
  });
});
