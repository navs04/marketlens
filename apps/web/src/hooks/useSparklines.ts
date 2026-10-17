import { useApiQuery } from "./useApiQuery";
import type { SparklineResponse } from "../api/types";

export interface PairRef {
  marketId: string;
  commodityId: string;
}

export const pairKey = (p: PairRef) => `${p.marketId}:${p.commodityId}`;

/** Recent daily series for many pairs in one request (table sparklines). */
export function useSparklines(pairs: PairRef[], days = 30) {
  // De-duplicate and cap so the URL stays small and the request is bounded.
  const unique = [...new Map(pairs.map((p) => [pairKey(p), p])).values()].slice(0, 100);
  const path =
    unique.length > 0 ? `/v1/prices/sparklines?days=${days}&pairs=${unique.map(pairKey).join(",")}` : null;
  return useApiQuery<{ data: SparklineResponse }>(path, [path]);
}
