import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuditLogPage } from "@/pages/audit/audit-log-page";
import { m3MockControl } from "@/mocks/fixtures/m3";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

let mockTenant = "acme";
vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: mockTenant }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m3MockControl.reset();
});
beforeEach(() => {
  mockTenant = "acme";
  m3MockControl.reset();
});
afterAll(() => mockServer.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/${mockTenant}/audit-log`]}>
      <Routes>
        <Route path="/:tenant/audit-log" element={<AuditLogPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuditLogPage", () => {
  it("renders tenant-scoped audit events", async () => {
    renderPage();
    expect(await screen.findByText("deploy.create")).toBeInTheDocument();
    expect(screen.getByText("approval.decide")).toBeInTheDocument();
    expect(screen.getByText("cloud-account.validate")).toBeInTheDocument();
    expect(screen.getByText("jane@acme.example")).toBeInTheDocument();
    expect(screen.getByText("instance/pg-orders")).toBeInTheDocument();
    expect(screen.queryByText("cluster.register")).not.toBeInTheDocument();
  });

  it("applies the actor filter and refetches", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("deploy.create");
    await user.type(screen.getByLabelText("Actor"), "platform-admin");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(screen.queryByText("deploy.create")).not.toBeInTheDocument();
    });
    expect(screen.getByText("approval.decide")).toBeInTheDocument();
    expect(screen.getByText("platform-admin@inari.dev")).toBeInTheDocument();
  });

  it("reset clears filters and shows all events again", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("deploy.create");
    await user.type(screen.getByLabelText("Actor"), "platform-admin");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(screen.queryByText("deploy.create")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(await screen.findByText("deploy.create")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("deploy.create");
    await user.type(screen.getByLabelText("Actor"), "nobody");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText(/No audit events match these filters/)).toBeInTheDocument();
  });

  it("renders an error message when the API fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/audit", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/Failed to load audit events: boom/)).toBeInTheDocument();
  });

  it("exports a CSV of the filtered events", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clicks: HTMLAnchorElement[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicks.push(this);
    };
    try {
      renderPage();
      await screen.findByText("deploy.create");
      await user.type(screen.getByLabelText("Actor"), "platform-admin");
      await user.click(screen.getByRole("button", { name: "Apply" }));
      await waitFor(() => {
        expect(screen.queryByText("deploy.create")).not.toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /Export CSV/ }));
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
      expect(clicks).toHaveLength(1);
      expect(clicks[0].download).toBe("audit-acme.csv");
      expect(clicks[0].href).toBe("blob:mock");
      const blob = createObjectURL.mock.calls[0][0] as unknown as Blob;
      const csv = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
      expect(csv).toContain("at,tenant,actor,action,objectType,objectName,detail");
      expect(csv).toContain("approval.decide");
      expect(csv).not.toContain("deploy.create");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("surfaces an error when the export fails", async () => {
    const { http, HttpResponse } = await import("msw");
    mockServer.use(
      http.get("*/api/v1/tenants/acme/audit/export", () =>
        HttpResponse.json({ message: "export boom" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("deploy.create");
    await user.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(await screen.findByText(/export boom/)).toBeInTheDocument();
  });
});
