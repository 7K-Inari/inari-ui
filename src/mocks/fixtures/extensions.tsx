import {
  ClusterTabBlueprint,
  InstanceActionBlueprint,
  createExtension,
  type ClusterTabSlotProps,
  type InariExtension,
} from "@7k-inari/ui-plugin-sdk";

import type { components } from "@/api/__generated__/schema";
import type { UiExtensionRemoteViewModel } from "@/api/extensions";

// The inari-ext-argocd reference extension (§5.8 "first-party eats the same
// dogfood"). Used by MSW handlers and component tests: the registry loads its
// remote module through this fixture instead of fetching remoteEntry.js.

export function ArgoCdHealthTab({ cluster }: ClusterTabSlotProps) {
  return (
    <div>
      <h2>ArgoCD health</h2>
      <p data-testid="argocd-cluster">{cluster.name}</p>
      <p>Applications on this cluster are Healthy.</p>
    </div>
  );
}

export const argocdSyncRunCalls: string[] = [];

export const argocdExtension: InariExtension = createExtension({
  manifest: {
    name: "inari-ext-argocd",
    version: "0.1.0",
    kind: "ui",
    title: "ArgoCD",
    description: "ArgoCD health tab and sync/refresh actions.",
  },
  slots: [
    ClusterTabBlueprint({
      name: "argocd-health",
      title: "ArgoCD",
      component: ArgoCdHealthTab,
    }),
    InstanceActionBlueprint({
      name: "argocd-sync",
      label: "Sync (ArgoCD)",
      run: (instance) => {
        argocdSyncRunCalls.push(instance.id);
      },
    }),
    InstanceActionBlueprint({
      name: "argocd-refresh",
      label: "Refresh (ArgoCD)",
      run: () => {},
    }),
  ],
});

type ServerExtension = components["schemas"]["Extension"];

export const argocdRemote: UiExtensionRemoteViewModel = {
  name: "inari-ext-argocd",
  version: "0.1.0",
  title: "ArgoCD",
  description: "ArgoCD health tab and sync/refresh actions.",
  remoteEntryUrl: "/extensions/inari-ext-argocd/remoteEntry.js",
  slots: [
    { kind: "cluster-tab", name: "argocd-health" },
    { kind: "instance-action", name: "argocd-sync" },
    { kind: "instance-action", name: "argocd-refresh" },
  ],
  enabled: true,
};

// Raw registry record, mirroring the huma wire contract (state, not healthy) —
// the client maps ready → healthy.
export const argocdBackendExtension: ServerExtension = {
  id: "ext-argocd",
  name: "inari-ext-argocd",
  version: "0.1.0",
  kind: "backend",
  endpoint: "https://argocd-extension.extensions.svc:8443",
  checksum: "sha256:9f2c1d4b",
  state: "ready",
  createdAt: "2026-01-15T10:00:00Z",
  updatedAt: "2026-01-15T10:00:00Z",
};
