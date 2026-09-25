import { parseExtensionManifest, type InariExtension } from "@7k-inari/ui-plugin-sdk";

import { API_BASE_URL } from "@/api/client";
import type { UiExtensionRemoteViewModel } from "@/api/extensions";
import { getHostRuntime } from "@/ext/host-runtime";

export type ExtensionLoader = (remote: UiExtensionRemoteViewModel) => Promise<InariExtension>;

// The registry returns a server-relative remoteEntryUrl (served by the
// control plane itself); Module Federation needs an absolute URL so chunk
// publicPath resolution works regardless of the current route.
export function resolveRemoteEntryUrl(remoteEntryUrl: string): string {
  if (/^https?:\/\//.test(remoteEntryUrl)) return remoteEntryUrl;
  return new URL(remoteEntryUrl, new URL(API_BASE_URL, window.location.origin)).toString();
}

interface RemoteExtensionModule {
  default?: InariExtension;
  manifest?: unknown;
}

// Loads a remote's `./extension` module and validates its manifest against the
// SDK contract. Any failure (network, invalid manifest, remote crash) throws;
// callers (registry) catch and mark the extension failed so the shell is never
// broken by a bad remote.
export const loadExtension: ExtensionLoader = async (remote) => {
  const runtime = getHostRuntime();
  // Webpack ModuleFederationPlugin container names must be valid JS
  // identifiers: a remote registered as "inari-ext-argocd" exposes its
  // container global as "inari_ext_argocd". entryGlobalName bridges the
  // registry name (dashes) to the container global (underscores).
  const entryGlobalName = remote.name.replace(/[^a-zA-Z0-9_$]/g, "_");
  runtime.registerRemotes([
    { name: remote.name, entry: resolveRemoteEntryUrl(remote.remoteEntryUrl), entryGlobalName },
  ]);
  const mod = (await runtime.loadRemote(`${remote.name}/extension`)) as
    | RemoteExtensionModule
    | InariExtension
    | null;
  if (!mod) throw new Error(`remote ${remote.name} exposed an empty module`);
  const extension: InariExtension =
    "manifest" in mod && mod.manifest !== undefined
      ? (mod as InariExtension)
      : ((mod as RemoteExtensionModule).default as InariExtension);
  if (!extension || !extension.manifest || !Array.isArray(extension.slots)) {
    throw new Error(`remote ${remote.name} did not expose an InariExtension`);
  }
  parseExtensionManifest(extension.manifest);
  return extension;
};
