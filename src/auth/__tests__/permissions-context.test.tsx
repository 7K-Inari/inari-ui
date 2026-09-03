import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PermissionsProvider, usePermissions } from "@/auth/permissions-context";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", authenticated: true }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

function Probe() {
  const { canCreateOrganizations } = usePermissions();
  return <span data-testid="can-create">{String(canCreateOrganizations)}</span>;
}

function renderProvider() {
  return render(
    <PermissionsProvider>
      <Probe />
    </PermissionsProvider>,
  );
}

describe("PermissionsProvider", () => {
  it("defaults to canCreateOrganizations=false before the fetch resolves", () => {
    mockServer.use(
      http.get("*/api/v1/me/permissions", () =>
        HttpResponse.json({ canCreateOrganizations: true }),
      ),
    );
    renderProvider();
    expect(screen.getByTestId("can-create")).toHaveTextContent("false");
  });

  it("exposes canCreateOrganizations=true when the endpoint allows it", async () => {
    mockServer.use(
      http.get("*/api/v1/me/permissions", () =>
        HttpResponse.json({ canCreateOrganizations: true }),
      ),
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("can-create")).toHaveTextContent("true"),
    );
  });

  it("stays false when the endpoint denies it", async () => {
    mockServer.use(
      http.get("*/api/v1/me/permissions", () =>
        HttpResponse.json({ canCreateOrganizations: false }),
      ),
    );
    renderProvider();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("can-create")).toHaveTextContent("false");
  });

  it("stays false when the fetch fails", async () => {
    mockServer.use(
      http.get("*/api/v1/me/permissions", () =>
        HttpResponse.json({ title: "Error", status: 500, detail: "boom" }, { status: 500 }),
      ),
    );
    renderProvider();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("can-create")).toHaveTextContent("false");
  });

  it("stays false when the response shape is unexpected", async () => {
    mockServer.use(
      http.get("*/api/v1/me/permissions", () => HttpResponse.json({})),
    );
    renderProvider();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("can-create")).toHaveTextContent("false");
  });
});
