import type { AnomalyFlagEntry, ForecastPoint, SeriesPoint } from "../api/types";

export interface ChartRow {
  /** Epoch ms at UTC midnight - the x value, so gaps in the data are drawn
   *  as real gaps in time rather than compressed away. */
  t: number;
  date: string; // YYYY-MM-DD
  price: number | null;
  /** Min..max reported across varieties that day (only if both exist). */
  range: [number, number] | null;
  /** Center forecast line. The last historical row also carries its own
   *  price here purely so the dashed line connects to the solid one. */
  forecast: number | null;
  /** Only true for genuine forecast rows - the bridge point above is not a prediction. */
  isForecast: boolean;
  forecastBand: [number, number] | null;
  /** Price at which to draw the anomaly marker, when this day was flagged. */
  anomalyPrice: number | null;
  anomaly: { expected: number; deviationPct: number } | null;
}

export interface ChartModel {
  rows: ChartRow[];
  lastHistoricalT: number | null;
  firstForecastT: number | null;
  anomalyCount: number;
  yDomain: [number, number] | null;
}

const toT = (isoDate: string) => Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);

/**
 * Merges the three real data sources into one row per date. Nothing is
 * generated here: every value comes from the series, a stored forecast, or
 * a stored anomaly score.
 */
export function buildChartModel(
  series: SeriesPoint[],
  forecasts: ForecastPoint[],
  anomalies: AnomalyFlagEntry[],
): ChartModel {
  const anomalyByDate = new Map<string, AnomalyFlagEntry>();
  for (const a of anomalies) {
    if (a.isAnomaly) anomalyByDate.set(a.date.slice(0, 10), a);
  }

  const rows: ChartRow[] = series.map((p) => {
    const date = p.date.slice(0, 10);
    const hasRange = p.minPrice !== null && p.maxPrice !== null && p.minPrice <= p.maxPrice;
    const anomaly = anomalyByDate.get(date);
    return {
      t: toT(date),
      date,
      price: p.price,
      range: hasRange ? [p.minPrice as number, p.maxPrice as number] : null,
      forecast: null,
      isForecast: false,
      forecastBand: null,
      anomalyPrice: anomaly ? p.price : null,
      anomaly: anomaly ? { expected: anomaly.expectedPrice, deviationPct: anomaly.deviationPct } : null,
    };
  });

  const lastHistorical = rows.length > 0 ? rows[rows.length - 1]! : null;
  const lastHistoricalT = lastHistorical?.t ?? null;

  // A forecast re-run after new data arrives can leave older forecast rows
  // for dates that are now in the past; only forecasts beyond the last
  // observed day belong on the chart.
  const futureForecasts = forecasts
    .filter((f) => lastHistoricalT === null || toT(f.forecastDate) > lastHistoricalT)
    .sort((a, b) => toT(a.forecastDate) - toT(b.forecastDate));

  if (lastHistorical && futureForecasts.length > 0) {
    lastHistorical.forecast = lastHistorical.price; // visual bridge only
  }

  for (const f of futureForecasts) {
    const date = f.forecastDate.slice(0, 10);
    const hasBand = f.lowerBound !== null && f.upperBound !== null && f.lowerBound <= f.upperBound;
    rows.push({
      t: toT(date),
      date,
      price: null,
      range: null,
      forecast: f.predictedPrice,
      isForecast: true,
      forecastBand: hasBand ? [f.lowerBound as number, f.upperBound as number] : null,
      anomalyPrice: null,
      anomaly: null,
    });
  }

  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rows) {
    for (const v of [r.price, r.forecast, ...(r.range ?? []), ...(r.forecastBand ?? [])]) {
      if (v === null) continue;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  const pad = (hi - lo) * 0.06 || hi * 0.05;
  const yDomain: [number, number] | null = Number.isFinite(lo) ? [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)] : null;

  return {
    rows,
    lastHistoricalT,
    firstForecastT: futureForecasts.length > 0 ? toT(futureForecasts[0]!.forecastDate) : null,
    anomalyCount: rows.filter((r) => r.anomaly).length,
    yDomain,
  };
}

/** Percent change from first to last value; null if it can't be computed honestly. */
export function percentChange(values: number[]): number | null {
  if (values.length < 2) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  if (!(first > 0)) return null;
  return ((last - first) / first) * 100;
}
