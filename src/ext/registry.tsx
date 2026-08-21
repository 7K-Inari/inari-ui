import * as React from "react";
import type { AnySlotContribution, InariExtension } from "@7k-inari/ui-plugin-sdk";

import {
  listUiExtensions,
  type SlotKind,
  type UiExtensionRemote,
} from "@/api/extensions";
import { useAuth } from "@/auth/auth-context";
import { loadExtension, type ExtensionLoader } from "@/ext/load-extension";
import { filterAllowedExtensions, getSelfExtensionPermissions } from "@/ext/rbac";
import { useTenant } from "@/tenant/tenant-context";

export type ExtensionLoadState = "loading" | "ready" | "failed";

export interface ExtensionEntry {
  remote: UiExtensionRemote;
  state: ExtensionLoadState;
  extension?: InariExtension;
  error?: string;
}

export interface SlotBinding {
  extensionName: string;
  slot: AnySlotContribution;
}

interface ExtensionsContextValue {
  entries: ExtensionEntry[];
  // true while the registry list itself is loading
  loading: boolean;
  slotsOf: (kind: SlotKind) => SlotBinding[];
  reload: () => void;
}

const ExtensionsContext = React.createContext<ExtensionsContextValue | null>(null);

export interface ExtensionsProviderProps {
  children: React.ReactNode;
  // Test seam: override the remote loader.
  loader?: ExtensionLoader;
  // Test seam: skip the network fetch entirely.
  initialRemotes?: UiExtensionRemote[];
}

export function ExtensionsProvider({
  children,
  loader = loadExtension,
  initialRemotes,
}: ExtensionsProviderProps) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [entries, setEntries] = React.useState<ExtensionEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEntries([]);

    async function run() {
      let remotes: UiExtensionRemote[];
      let permissions: string[] | null = null;
      try {
        if (initialRemotes) {
          remotes = initialRemotes;
        } else {
          [remotes, permissions] = await Promise.all([
            listUiExtensions(token, tenant),
            getSelfExtensionPermissions(token, tenant).catch(() => null),
          ]);
        }
      } catch {
        // Registry endpoint unavailable (older server) — no extensions, shell unaffected.
        if (!cancelled) setLoading(false);
        return;
      }

      const allowed = filterAllowedExtensions(permissions, remotes).filter(
        (r) => r.enabled,
      );
      if (cancelled) return;
      setEntries(allowed.map((remote) => ({ remote, state: "loading" })));
      setLoading(false);

      await Promise.all(
        allowed.map(async (remote) => {
          let update: ExtensionEntry;
          try {
            const extension = await loader(remote);
            update = { remote, state: "ready", extension };
          } catch (err) {
            console.error(`[inari] failed to load extension ${remote.name}:`, err);
            update = {
              remote,
              state: "failed",
              error: err instanceof Error ? err.message : "load failed",
            };
          }
          if (cancelled) return;
          setEntries((prev) =>
            prev.map((e) => (e.remote.name === remote.name ? update : e)),
          );
        }),
      );
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenant, tick, loader]);

  const slotsOf = React.useCallback(
    (kind: SlotKind): SlotBinding[] =>
      entries.flatMap((e) =>
        e.state === "ready" && e.extension
          ? e.extension.slots
              .filter((s) => s.kind === kind)
              .map((slot) => ({ extensionName: e.remote.name, slot }))
          : [],
      ),
    [entries],
  );

  const value: ExtensionsContextValue = {
    entries,
    loading,
    slotsOf,
    reload: () => setTick((t) => t + 1),
  };

  return (
    <ExtensionsContext.Provider value={value}>{children}</ExtensionsContext.Provider>
  );
}

export function useExtensions(): ExtensionsContextValue {
  const ctx = React.useContext(ExtensionsContext);
  if (!ctx) throw new Error("useExtensions must be used within ExtensionsProvider");
  return ctx;
}

// Returns null outside an ExtensionsProvider so shared components (e.g.
// SchemaForm, used in standalone tests) degrade to "no extensions".
export function useExtensionsOptional(): ExtensionsContextValue | null {
  return React.useContext(ExtensionsContext);
}

export function useSlots(kind: SlotKind): SlotBinding[] {
  const ctx = React.useContext(ExtensionsContext);
  return React.useMemo(() => (ctx ? ctx.slotsOf(kind) : []), [ctx, kind]);
}
