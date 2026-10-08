import { useApiQuery } from "./useApiQuery";
import type { MarketComparisonEntry } from "../api/types";

export function useMarketComparison(commodityId: string | null, state: string | null) {
  const path = commodityId
    ? `/v1/prices/compare?commodityId=${commodityId}${state ? `&state=${encodeURIComponent(state)}` : ""}`
    : null;
  return useApiQuery<{ data: MarketComparisonEntry[] }>(path, [commodityId, state]);
}
