import { useApiQuery } from "./useApiQuery";
import type { Market, MarketCommodityEntry } from "../api/types";

export function useMarketCommodities(marketId: string | null) {
  return useApiQuery<{ data: { market: Market; commodities: MarketCommodityEntry[] } }>(
    marketId ? `/v1/markets/${marketId}/commodities` : null,
    [marketId],
  );
}

export function useMarketStates() {
  return useApiQuery<{ data: string[] }>("/v1/markets/states");
}
