import { parseExtensionManifest, type InariExtension } from "@7k-inari/ui-plugin-sdk";

import { API_BASE_URL } from "@/api/client";
import type { UiExtensionRemote } from "@/api/extensions";
import { getHostRuntime } from "@/ext/host-runtime";

export type ExtensionLoader = (remote: UiExtensionRemote) => Promise<InariExtension>;

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

// Webpack container globals are valid JS identifiers: the registry name
// ("inari-ext-argocd") is not what the remoteEntry exports ("inari_ext_argocd"),
// and the MF runtime resolves the container by registered name (RUNTIME-001).
export function containerName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_$]/g, "_");
}

// Loads a remote's `./extension` module and validates its manifest against the
// SDK contract. Any failure (network, invalid manifest, remote crash) throws;
// callers (registry) catch and mark the extension failed so the shell is never
// broken by a bad remote.
export const loadExtension: ExtensionLoader = async (remote) => {
  const runtime = getHostRuntime();
  const mfName = containerName(remote.name);
  runtime.registerRemotes([{ name: mfName, entry: resolveRemoteEntryUrl(remote.remoteEntryUrl) }]);
  const mod = (await runtime.loadRemote(`${mfName}/extension`)) as
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
