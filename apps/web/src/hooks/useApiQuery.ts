import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiRequestError } from "../api/client";

export type QueryState<T> =
  | { status: "idle" }
  | { status: "loading" }
  /** `stale` is true while a refetch is in flight and `keepPrevious` is on:
   *  `data` is the previous result, shown dimmed rather than a blank skeleton. */
  | { status: "ok"; data: T; stale?: boolean }
  | { status: "error"; message: string; notFound: boolean; retry: () => void };

interface Options {
  /** Keep showing the last successful result while a new request loads
   *  (paging, range switches) instead of flashing back to a skeleton. */
  keepPrevious?: boolean;
}

/**
 * Shared data-fetching primitive. `path` may be null to skip fetching
 * entirely (e.g. a dependent query waiting on a prerequisite) - callers
 * get `{ status: "idle" }`. `notFound` on the error state lets callers
 * render a dedicated empty state for a 404, and `retry` re-runs the
 * request.
 */
export function useApiQuery<T>(path: string | null, deps: unknown[] = [], options: Options = {}): QueryState<T> {
  const { keepPrevious = false } = options;
  const [state, setState] = useState<QueryState<T>>(path ? { status: "loading" } : { status: "idle" });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState((prev) =>
      keepPrevious && prev.status === "ok" ? { status: "ok", data: prev.data, stale: true } : { status: "loading" },
    );

    apiClient
      .get<T>(path)
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const notFound = err instanceof ApiRequestError && err.status === 404;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Request failed",
          notFound,
          retry,
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return state;
}
