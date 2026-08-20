import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  NavItemBlueprint,
  PageBlueprint,
  createExtension,
} from "@inari/ui-plugin-sdk";

import type {
  CatalogItemSummary,
  ResourceInstanceDetail,
} from "@/api/types";
import { ExtensionsProvider } from "@/ext/registry";
import {
  CatalogCardSlots,
  ExtensionNavItems,
  InstanceActionButtons,
  useClusterTabSlots,
} from "@/ext/slots";
import {
  argocdExtension,
  argocdRemote,
  argocdSyncRunCalls,
} from "@/mocks/fixtures/extensions";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "t", parsedToken: undefined }),
}));

vi.mock("@/tenant/tenant-context", () => ({
  useTenant: () => ({ tenant: "acme" }),
}));

const loader = () => Promise.resolve(argocdExtension);

function renderWithExtensions(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ExtensionsProvider initialRemotes={[argocdRemote]} loader={loader}>
        {ui}
      </ExtensionsProvider>
    </MemoryRouter>,
  );
}

const cluster = {
  id: "c1",
  name: "prod-eu",
  tenant: "acme",
  status: "connected" as const,
  k8sVersion: "1.30",
  labels: {},
  capabilityCount: 0,
  lastSeenAt: null,
  createdAt: "",
};

const instance: ResourceInstanceDetail = {
  id: "ri-1",
  name: "web-svc",
  tenant: "acme",
  catalogItemId: "web-service",
  catalogItemName: "Web Service",
  version: "1.2.0",
  clusterId: "c1",
  clusterName: "prod-eu",
  health: "healthy",
  status: "Synced",
  ownerTeam: "payments",
  updateAvailable: null,
  createdAt: "",
  spec: {},
  composedResources: [],
  argocdUrl: null,
};

function ClusterTabsProbe() {
  const tabs = useClusterTabSlots();
  return (
    <div>
      {tabs.map((t) => (
        <div key={t.id}>
          <span data-testid="tab-title">{t.title}</span>
          <t.component
            cluster={{ id: cluster.id, name: cluster.name, tenantId: "acme", state: "Active" }}
          />
        </div>
      ))}
    </div>
  );
}

describe("blueprint slot wiring (inari-ext-argocd)", () => {
  it("renders the ArgoCD cluster tab contributed by the remote", async () => {
    renderWithExtensions(<ClusterTabsProbe />);
    await waitFor(() => expect(screen.getByTestId("tab-title")).toHaveTextContent("ArgoCD"));
    expect(screen.getByTestId("argocd-cluster")).toHaveTextContent("prod-eu");
  });

  it("runs the ArgoCD sync instance action", async () => {
    argocdSyncRunCalls.length = 0;
    renderWithExtensions(<InstanceActionButtons instance={instance} />);
    const button = await screen.findByRole("button", { name: "Sync (ArgoCD)" });
    await userEvent.click(button);
    expect(argocdSyncRunCalls).toEqual(["ri-1"]);
  });

  it("surfaces action failures inline", async () => {
    const failing = createExtension({
      manifest: { name: "bad-ext", version: "0.0.1", kind: "ui" },
      slots: [
        {
          kind: "instance-action",
          name: "explode",
          props: {
            label: "Explode",
            run: () => {
              throw new Error("action exploded");
            },
          },
        },
      ],
    });
    render(
      <MemoryRouter>
        <ExtensionsProvider
          initialRemotes={[{ ...argocdRemote, name: "bad-ext", slots: [{ kind: "instance-action", name: "explode" }] }]}
          loader={() => Promise.resolve(failing)}
        >
          <InstanceActionButtons instance={instance} />
        </ExtensionsProvider>
      </MemoryRouter>,
    );
    const button = await screen.findByRole("button", { name: "Explode" });
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("action exploded");
  });

  it("renders catalog card slots with the mapped catalog item", async () => {
    const cardExt = createExtension({
      manifest: { name: "cost-ext", version: "0.0.1", kind: "ui" },
      slots: [
        {
          kind: "catalog-card",
          name: "cost-badge",
          props: {},
          component: ({ catalogItem }: { catalogItem: { name: string } }) => (
            <span data-testid="cost-badge">est. cost for {catalogItem.name}</span>
          ),
        },
      ],
    });
    const item: CatalogItemSummary = {
      id: "web-service",
      name: "web-service",
      displayName: "Web Service",
      description: "",
      source: "curated",
      category: "apps",
      latestVersion: "1.2.0",
      compatibleClusterIds: null,
    };
    render(
      <MemoryRouter>
        <ExtensionsProvider
          initialRemotes={[{ ...argocdRemote, name: "cost-ext", slots: [{ kind: "catalog-card", name: "cost-badge" }] }]}
          loader={() => Promise.resolve(cardExt)}
        >
          <CatalogCardSlots item={item} />
        </ExtensionsProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("cost-badge")).toHaveTextContent("web-service");
  });

  it("renders nav-item slots in the sidebar extension section", async () => {
    const navExt = createExtension({
      manifest: { name: "nav-ext", version: "0.0.1", kind: "ui" },
      slots: [
        NavItemBlueprint({ name: "argocd-nav", title: "ArgoCD", path: "argocd" }),
        PageBlueprint({
          name: "argocd-page",
          path: "argocd",
          component: () => <p>ArgoCD page</p>,
        }),
      ],
    });
    render(
      <MemoryRouter>
        <ExtensionsProvider
          initialRemotes={[{ ...argocdRemote, name: "nav-ext", slots: [{ kind: "nav-item", name: "argocd-nav" }] }]}
          loader={() => Promise.resolve(navExt)}
        >
          <ExtensionNavItems tenant="acme" />
        </ExtensionsProvider>
      </MemoryRouter>,
    );
    const link = await screen.findByRole("link", { name: "ArgoCD" });
    expect(link).toHaveAttribute("href", "/acme/ext/argocd");
  });
});
