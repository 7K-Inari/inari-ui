import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FormWidgetBlueprint, PageBlueprint, createExtension } from "@inari/ui-plugin-sdk";

import { SchemaForm } from "@/components/schema-form/schema-form";
import { ExtensionsProvider } from "@/ext/registry";
import { ExtensionNavItems, ExtensionPageHost } from "@/ext/slots";
import { argocdExtension, argocdRemote } from "@/mocks/fixtures/extensions";
import { m4MockControl } from "@/mocks/fixtures/m4";
import { mockServer } from "@/mocks/server";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token", parsedToken: undefined }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  m4MockControl.reset();
});
afterAll(() => mockServer.close());

describe("QA: extension RBAC", () => {
  it("does not load or render slots for extensions the caller may not invoke", async () => {
    mockServer.use(
      http.get("*/api/v1/tenants/:org/authz/self/extensions", () =>
        HttpResponse.json({ permissions: ["extensions:invoke:something-else"] }),
      ),
    );
    const loader = vi.fn(() => Promise.resolve(argocdExtension));
    render(
      <MemoryRouter>
        <ExtensionsProvider loader={loader}>
          <ExtensionNavItems tenant="acme" />
        </ExtensionsProvider>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText("Extensions")).not.toBeInTheDocument(),
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(loader).not.toHaveBeenCalled();
  });
});

describe("QA: Page slot host", () => {
  const pageExt = createExtension({
    manifest: { name: "page-ext", version: "0.0.1", kind: "ui" },
    slots: [
      PageBlueprint({
        name: "argocd-page",
        path: "argocd",
        component: () => <p>ArgoCD extension page</p>,
      }),
    ],
  });
  const remote = { ...argocdRemote, name: "page-ext", slots: [{ kind: "page" as const, name: "argocd-page" }] };
  const loader = () => Promise.resolve(pageExt);

  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <ExtensionsProvider initialRemotes={[remote]} loader={loader}>
          <Routes>
            <Route
              path="/:tenant/ext/*"
              element={
                <ExtensionPageHost
                  context={{ auth: { principal: null, getToken: () => undefined }, tenant: { current: null, available: [], switchTenant: () => {}, onTenantChange: () => () => {} } }}
                />
              }
            />
          </Routes>
        </ExtensionsProvider>
      </MemoryRouter>,
    );
  }

  it("renders the extension page at its registered path", async () => {
    renderAt("/acme/ext/argocd");
    expect(await screen.findByText("ArgoCD extension page")).toBeInTheDocument();
  });

  it("shows a fallback for unregistered extension paths", async () => {
    renderAt("/acme/ext/does-not-exist");
    expect(
      await screen.findByText(/No extension page is registered/),
    ).toBeInTheDocument();
  });
});

describe("QA: FormWidget slot", () => {
  // Regression: extension widgets load asynchronously; SchemaForm must survive
  // the initial render (boundary) and recover once the widget arrives.
  it("resolves an extension widget via ui:widget in SchemaForm", async () => {
    const widgetExt = createExtension({
      manifest: { name: "widget-ext", version: "0.0.1", kind: "ui" },
      slots: [
        FormWidgetBlueprint({
          name: "secret-picker",
          component: () => <input data-testid="secret-picker" />,
        }),
      ],
    });
    render(
      <MemoryRouter>
        <ExtensionsProvider
          initialRemotes={[{ ...argocdRemote, name: "widget-ext", slots: [{ kind: "form-widget", name: "secret-picker" }] }]}
          loader={() => Promise.resolve(widgetExt)}
        >
          <SchemaForm
            schema={{
              type: "object",
              properties: { secret: { type: "string", title: "Secret" } },
            }}
            uiSchema={{ secret: { "ui:widget": "secret-picker" } }}
            formData={{}}
            onChange={() => {}}
          />
        </ExtensionsProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("secret-picker")).toBeInTheDocument();
  });
});
