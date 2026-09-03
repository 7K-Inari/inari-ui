import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PermissionsProvider } from "@/auth/permissions-context";
import { mockServer } from "@/mocks/server";
import { CreateOrganizationPage } from "@/pages/organizations/create-organization";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", authenticated: true }),
}));

vi.mock("@/auth/keycloak", () => ({
  keycloak: { updateToken: vi.fn().mockResolvedValue(true) },
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/create-organization"]}>
      <PermissionsProvider>
        <Routes>
          <Route path="/create-organization" element={<CreateOrganizationPage />} />
          <Route path="/:tenant/overview" element={<div>overview</div>} />
        </Routes>
      </PermissionsProvider>
    </MemoryRouter>,
  );
}

describe("QA probes", () => {
  it("keeps the submit button disabled for a whitespace-only display name", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Display name"), "   ");
    await user.type(screen.getByLabelText("Slug"), "probe");
    expect(screen.getByRole("button", { name: /create organization/i })).toBeDisabled();
  });

  it("accepts slug with trailing dash (regex-permitted)", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Display name"), "Probe");
    await user.type(screen.getByLabelText("Slug"), "acme-");
    await user.click(screen.getByRole("button", { name: /create organization/i }));
    expect(await screen.findByText("overview")).toBeInTheDocument();
  });

  it("clears a previous generic error on retry", async () => {
    let calls = 0;
    mockServer.use(
      http.post("*/api/v1/tenants", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ title: "Error", status: 500, detail: "boom" }, { status: 500 });
        }
        return HttpResponse.json(
          { tenant: { id: "t-1", slug: "probe", name: "Probe" } },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Display name"), "Probe");
    await user.type(screen.getByLabelText("Slug"), "probe");
    const submit = screen.getByRole("button", { name: /create organization/i });
    await user.click(submit);
    expect(await screen.findByText("boom")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create organization/i }));
    expect(await screen.findByText("overview")).toBeInTheDocument();
  });
});
