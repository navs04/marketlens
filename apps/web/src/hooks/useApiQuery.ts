import { useEffect, useState } from "react";
import { apiClient, ApiRequestError } from "../api/client";

export type QueryState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; message: string; notFound: boolean };

/**
 * Shared data-fetching primitive. `path` may be null to skip fetching
 * entirely (e.g. a dependent query waiting on a prerequisite selection) -
 * callers get back `{ status: "idle" }` rather than an error in that case.
 * `notFound` on the error state lets callers render a dedicated empty
 * state for a 404 (e.g. "no data for this pair yet") rather than a
 * generic failure message.
 */
export function useApiQuery<T>(path: string | null, deps: unknown[] = []): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>(path ? { status: "loading" } : { status: "idle" });

  useEffect(() => {
    if (!path) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

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
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return state;
}
