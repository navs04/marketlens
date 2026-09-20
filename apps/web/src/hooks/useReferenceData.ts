import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { Commodity, Market } from "../api/types";

type ListState<T> =
  | { status: "loading" }
  | { status: "ok"; items: T[] }
  | { status: "error"; message: string };

function useApiList<T>(path: string) {
  const [state, setState] = useState<ListState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<{ data: T[] }>(path)
      .then(({ data }) => {
        if (!cancelled) setState({ status: "ok", items: data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load data",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}

export const useMarkets = () => useApiList<Market>("/v1/markets");
export const useCommodities = () => useApiList<Commodity>("/v1/commodities");
