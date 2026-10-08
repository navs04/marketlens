import { useApiQuery } from "./useApiQuery";
import type { AnomalyFeedEntry, SpikeRiskFeedEntry } from "../api/types";

export function useAnomalyFeed(limit = 50) {
  return useApiQuery<{ data: AnomalyFeedEntry[] }>(`/v1/anomalies/feed?limit=${limit}`, [limit]);
}

export function useSpikeRiskFeed(limit = 50, minProbability = 0.4) {
  return useApiQuery<{ data: SpikeRiskFeedEntry[] }>(
    `/v1/spike-risk/feed?limit=${limit}&minProbability=${minProbability}`,
    [limit, minProbability],
  );
}
