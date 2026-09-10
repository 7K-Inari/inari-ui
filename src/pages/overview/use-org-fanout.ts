import * as React from "react";

import type { AsyncState } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";

export interface OrgFanoutEntry<T> {
  org: string;
  state: AsyncState<T>;
}

export interface OrgFanoutResult<T> {
  entries: OrgFanoutEntry<T>[];
  overflow: number;
  refetchAll: () => void;
}

const DEFAULT_CAP = 10;

// Bounded cross-org fan-out for the all-tenants home (no wildcard tenant
// exists in the contract): one settled Promise per org, capped, with per-org
// error isolation so one failing org never blanks its siblings. Polling
// discipline mirrors useAsyncResource (interval tick, skipped while the tab
// is hidden).
export function useOrgFanout<T>(
  orgs: string[],
  fetcher: (token: string | undefined, org: string) => Promise<T>,
  options: { cap?: number; refetchIntervalMs?: number } = {},
): OrgFanoutResult<T> {
  const { token } = useAuth();
  const { cap = DEFAULT_CAP, refetchIntervalMs } = options;
  const capped = React.useMemo(() => orgs.slice(0, cap), [orgs, cap]);
  const overflow = Math.max(0, orgs.length - capped.length);
  const orgsKey = capped.join("\n");

  const [states, setStates] = React.useState<
    Record<string, { data: T | null; loading: boolean; error: Error | null }>
  >({});
  const [tick, setTick] = React.useState(0);

  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  React.useEffect(() => {
    if (!orgsKey) return;
    let cancelled = false;
    const list = orgsKey.split("\n");
    setStates((prev) => {
      const next: typeof prev = {};
      for (const org of list) {
        next[org] = { data: prev[org]?.data ?? null, loading: true, error: null };
      }
      return next;
    });
    Promise.allSettled(list.map((org) => fetcherRef.current(token, org))).then((results) => {
      if (cancelled) return;
      setStates((prev) => {
        const next = { ...prev };
        results.forEach((result, i) => {
          const org = list[i];
          next[org] =
            result.status === "fulfilled"
              ? { data: result.value, loading: false, error: null }
              : {
                  data: prev[org]?.data ?? null,
                  loading: false,
                  error:
                    result.reason instanceof Error
                      ? result.reason
                      : new Error("Request failed"),
                };
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [token, orgsKey, tick]);

  React.useEffect(() => {
    if (!refetchIntervalMs) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setTick((t) => t + 1);
    }, refetchIntervalMs);
    return () => clearInterval(id);
  }, [refetchIntervalMs]);

  const refetchAll = React.useCallback(() => setTick((t) => t + 1), []);

  const entries = React.useMemo(
    () =>
      capped.map((org) => ({
        org,
        state: {
          data: states[org]?.data ?? null,
          loading: states[org]?.loading ?? true,
          error: states[org]?.error ?? null,
          refetch: refetchAll,
        },
      })),
    [capped, states, refetchAll],
  );

  return { entries, overflow, refetchAll };
}
