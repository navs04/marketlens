import { useApiQuery } from "./useApiQuery";
import type {
  AnomalyFlagEntry,
  ExplanationResponse,
  ForecastResponse,
  PriceObservation,
  PriceSummary,
  SpikeRiskScoreData,
} from "../api/types";

interface Pair {
  marketId: string | null;
  commodityId: string | null;
}

function pairPath(base: string, { marketId, commodityId }: Pair, extra = ""): string | null {
  if (!marketId || !commodityId) return null;
  return `${base}?marketId=${marketId}&commodityId=${commodityId}${extra}`;
}

export function usePriceSummary(pair: Pair) {
  return useApiQuery<{ data: PriceSummary }>(pairPath("/v1/prices/summary", pair), [pair.marketId, pair.commodityId]);
}

export function usePriceHistory(pair: Pair, days = 90) {
  return useApiQuery<{ data: PriceObservation[] }>(
    pairPath("/v1/prices", pair, `&limit=${days}`),
    [pair.marketId, pair.commodityId, days],
  );
}

export function useForecast(pair: Pair) {
  return useApiQuery<{ data: ForecastResponse }>(
    pairPath("/v1/forecasts", pair),
    [pair.marketId, pair.commodityId],
  );
}

export function useAnomalyHistory(pair: Pair, days = 90) {
  return useApiQuery<{ data: AnomalyFlagEntry[] }>(
    pairPath("/v1/anomalies", pair, `&limit=${days}`),
    [pair.marketId, pair.commodityId, days],
  );
}

export function useSpikeRisk(pair: Pair) {
  return useApiQuery<{ data: SpikeRiskScoreData | null }>(
    pairPath("/v1/spike-risk", pair),
    [pair.marketId, pair.commodityId],
  );
}

export function useExplanation(pair: Pair) {
  return useApiQuery<{ data: ExplanationResponse }>(
    pairPath("/v1/explanation", pair),
    [pair.marketId, pair.commodityId],
  );
}
