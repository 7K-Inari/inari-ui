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

// Typed load failure that keeps the fetch cause (entry URL, HTTP status,
// server detail, network error) instead of collapsing it into a generic
// "load failed" message. Follows the ExtensionAuthError precedent
// (src/ext/sso-session.ts).
export class ExtensionLoadError extends Error {
  entryUrl: string;
  status?: number;
  detail?: string;

  constructor(
    entryUrl: string,
    message: string,
    options?: { status?: number; detail?: string; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ExtensionLoadError";
    this.entryUrl = entryUrl;
    this.status = options?.status;
    this.detail = options?.detail;
  }
}

export type RemoteEntryHealth =
  | { status: "healthy" }
  // Cross-origin remoteEntry without CORS headers: the host is reachable but
  // the response is opaque, so an HTTP failure status cannot be observed.
  // Callers should warn and proceed rather than hard-fail.
  | { status: "unverifiable"; reason: string }
  | { status: "unhealthy"; error: ExtensionLoadError };

// Preflights the remoteEntry URL so a dead or misconfigured remote surfaces
// the real fetch cause (URL + HTTP status + server detail / network error)
// instead of a bare script-load failure from the MF runtime. Uses
// mode: "no-cors" so cross-origin remotes served without CORS headers (a
// valid setup: the MF runtime loads remoteEntry via a script tag, which is
// not CORS-restricted) are still reachable-checked; same-origin responses
// stay fully readable, cross-origin ones come back opaque.
export async function checkRemoteEntryHealth(
  remoteEntryUrl: string,
): Promise<RemoteEntryHealth> {
  const entryUrl = resolveRemoteEntryUrl(remoteEntryUrl);
  let res: Response;
  try {
    res = await fetch(entryUrl, { mode: "no-cors" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "unhealthy",
      error: new ExtensionLoadError(
        entryUrl,
        `Failed to fetch remoteEntry ${entryUrl}: ${message}`,
        { cause: err },
      ),
    };
  }
  if (res.type === "opaque") {
    return {
      status: "unverifiable",
      reason: `${entryUrl} is cross-origin and not CORS-readable; reachability confirmed but the HTTP status cannot be observed`,
    };
  }
  if (!res.ok) {
    // The control plane proxies remoteEntry and returns huma ErrorModel JSON
    // ({ title, status, detail }) on upstream failures; best-effort parse.
    let detail: string | undefined;
    try {
      const data = JSON.parse(await res.text()) as { detail?: string; title?: string };
      detail = data.detail ?? data.title;
    } catch {
      // non-JSON body (e.g. a bare proxy error page) — status alone is enough
    }
    return {
      status: "unhealthy",
      error: new ExtensionLoadError(
        entryUrl,
        `Failed to fetch remoteEntry ${entryUrl}: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`,
        { status: res.status, detail },
      ),
    };
  }
  return { status: "healthy" };
}

// Loads a remote's `./extension` module and validates its manifest against the
// SDK contract. Any failure (network, invalid manifest, remote crash) throws;
// callers (registry) catch and mark the extension failed so the shell is never
// broken by a bad remote.
export const loadExtension: ExtensionLoader = async (remote) => {
  const entryUrl = resolveRemoteEntryUrl(remote.remoteEntryUrl);
  const health = await checkRemoteEntryHealth(remote.remoteEntryUrl);
  if (health.status === "unhealthy") throw health.error;
  if (health.status === "unverifiable") {
    console.warn(`[inari] remoteEntry health unverifiable for ${remote.name}: ${health.reason}`);
  }
  const runtime = getHostRuntime();
  // Webpack ModuleFederationPlugin container names must be valid JS
  // identifiers: a remote registered as "inari-ext-argocd" exposes its
  // container global as "inari_ext_argocd". entryGlobalName bridges the
  // registry name (dashes) to the container global (underscores).
  const entryGlobalName = remote.name.replace(/[^a-zA-Z0-9_$]/g, "_");
  runtime.registerRemotes([{ name: remote.name, entry: entryUrl, entryGlobalName }]);
  let mod: RemoteExtensionModule | InariExtension | null;
  try {
    mod = (await runtime.loadRemote(`${remote.name}/extension`)) as
      | RemoteExtensionModule
      | InariExtension
      | null;
  } catch (err) {
    // The MF runtime rejects with a generic script/chunk error; re-throw with
    // the entry URL and original cause attached so the failure is debuggable.
    if (err instanceof ExtensionLoadError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new ExtensionLoadError(
      entryUrl,
      `Failed to load remote ${remote.name} from ${entryUrl}: ${message}`,
      { cause: err },
    );
  }
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
