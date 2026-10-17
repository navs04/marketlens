import { useApiQuery } from "./useApiQuery";
import type { MoversResponse } from "../api/types";

export function useMovers(windowDays = 7, limit = 4) {
  return useApiQuery<{ data: MoversResponse }>(`/v1/prices/movers?windowDays=${windowDays}&limit=${limit}`, [
    windowDays,
    limit,
  ]);
}
