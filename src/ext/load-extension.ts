import { parseExtensionManifest, type InariExtension } from "@7k-inari/ui-plugin-sdk";

import type { UiExtensionRemote } from "@/api/extensions";
import { getHostRuntime } from "@/ext/host-runtime";

export type ExtensionLoader = (remote: UiExtensionRemote) => Promise<InariExtension>;

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
  runtime.registerRemotes([{ name: remote.name, entry: remote.remoteEntryUrl }]);
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
