import * as React from "react";

import { useAuth } from "@/auth/auth-context";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface PollOptions {
  refetchIntervalMs?: number;
  enabled?: boolean;
}

export function useAsyncResource<T>(
  fetcher: (token: string | undefined) => Promise<T>,
  deps: React.DependencyList,
  options: PollOptions = {},
): AsyncState<T> {
  const { token } = useAuth();
  const { refetchIntervalMs, enabled = true } = options;
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [tick, setTick] = React.useState(0);

  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    fetcherRef
      .current(token)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error("Request failed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled, tick, ...deps]);

  React.useEffect(() => {
    if (!enabled || !refetchIntervalMs) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setTick((t) => t + 1);
    }, refetchIntervalMs);
    return () => clearInterval(id);
  }, [enabled, refetchIntervalMs]);

  const refetch = React.useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}
