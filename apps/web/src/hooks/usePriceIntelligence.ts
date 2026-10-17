import { useApiQuery } from "./useApiQuery";
import type {
  AnomalyFlagEntry,
  ExplanationResponse,
  ForecastResponse,
  PriceRange,
  PriceSeries,
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

/**
 * Daily series for the chart, anchored to the pair's own latest date and
 * aggregated to one point per day on the server. `keepPrevious` so
 * switching 30D/90D/1Y dims the old chart instead of blanking it.
 */
export function usePriceSeries(pair: Pair, range: PriceRange) {
  return useApiQuery<{ data: PriceSeries }>(
    pairPath("/v1/prices/series", pair, `&range=${range}`),
    [pair.marketId, pair.commodityId, range],
    { keepPrevious: true },
  );
}

export function useForecast(pair: Pair) {
  return useApiQuery<{ data: ForecastResponse }>(
    pairPath("/v1/forecasts", pair),
    [pair.marketId, pair.commodityId],
  );
}

/**
 * Anomaly scores from `from` (YYYY-MM-DD) onward - the first date of the
 * plotted series, so markers cover exactly the visible window. Waits (idle)
 * until the series has loaded and told us what that date is.
 */
export function useAnomalyHistory(pair: Pair, from: string | null) {
  const base = from ? pairPath("/v1/anomalies", pair, `&from=${from}&limit=400`) : null;
  return useApiQuery<{ data: AnomalyFlagEntry[] }>(base, [pair.marketId, pair.commodityId, from], {
    keepPrevious: true,
  });
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
