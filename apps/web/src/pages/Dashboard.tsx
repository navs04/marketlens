import { useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { MetricCard } from "../components/ui/MetricCard";
import { StateMessage } from "../components/ui/StateMessage";
import { PriceTrendChart } from "../components/charts/PriceTrendChart";
import { MoversPanel } from "../components/dashboard/MoversPanel";
import { useSelection } from "../context/SelectionContext";
import { useOverview } from "../hooks/useOverview";
import {
  useAnomalyHistory,
  useExplanation,
  useForecast,
  usePriceSeries,
  usePriceSummary,
  useSpikeRisk,
} from "../hooks/usePriceIntelligence";
import type { PriceRange } from "../api/types";

const VALID_RANGES: PriceRange[] = ["30D", "90D", "1Y"];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

/** One bordered strip with hairline dividers instead of four separate cards. */
function OverviewStrip() {
  const overview = useOverview();

  if (overview.status === "loading" || overview.status === "idle") {
    return <div className="h-[68px] animate-pulse rounded-md bg-paper-sunken" aria-busy="true" aria-label="Loading overview" />;
  }

  if (overview.status === "error") {
    return (
      <Card>
        <StateMessage compact kind="error" title="Couldn't load the overview" action={{ label: "Try again", onClick: overview.retry }} />
      </Card>
    );
  }

  const { data } = overview.data;
  const cells: Array<{ label: string; value: string }> = [
    { label: "Commodities tracked", value: data.commoditiesTracked.toLocaleString("en-IN") },
    { label: "Markets tracked", value: data.marketsTracked.toLocaleString("en-IN") },
    { label: "Latest data", value: formatDate(data.latestDataDate) },
    { label: "Anomalies detected", value: data.anomaliesDetected.toLocaleString("en-IN") },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-paper-raised px-4 py-3">
          <dt className="text-xs text-ink-muted">{cell.label}</dt>
          <dd className="mt-0.5 font-mono text-lg font-medium text-ink">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Dashboard() {
  const { selectedMarket, selectedCommodity, markets, commodities } = useSelection();
  const [searchParams, setSearchParams] = useSearchParams();

  const rangeParam = searchParams.get("range") as PriceRange | null;
  const range: PriceRange = rangeParam && VALID_RANGES.includes(rangeParam) ? rangeParam : "90D";
  const setRange = (next: PriceRange) =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("range", next);
      return params;
    });

  const pair = { marketId: selectedMarket?.id ?? null, commodityId: selectedCommodity?.id ?? null };

  const summary = usePriceSummary(pair);
  const series = usePriceSeries(pair, range);
  const seriesPoints = series.status === "ok" ? series.data.data.points : [];
  const firstSeriesDate = seriesPoints[0]?.date.slice(0, 10) ?? null;
  const anomalies = useAnomalyHistory(pair, firstSeriesDate);
  const forecast = useForecast(pair);
  const spikeRisk = useSpikeRisk(pair);
  const explanation = useExplanation(pair);

  const stillLoadingSelection = markets.status === "loading" || commodities.status === "loading";
  const nothingSelected = !selectedMarket || !selectedCommodity;
  const subject = nothingSelected ? "" : `${selectedCommodity.name}, ${selectedMarket.name}, ${selectedMarket.state}`;

  const chartStatus =
    series.status === "error" ? "error" : series.status === "ok" ? "ready" : "loading";

  return (
    <div className="flex flex-col gap-6">
      <OverviewStrip />

      <div>
        {stillLoadingSelection ? (
          <div className="h-8 w-72 animate-pulse rounded bg-paper-sunken" />
        ) : nothingSelected ? (
          <h1 className="font-display text-2xl font-semibold text-ink">Select a commodity and market to begin</h1>
        ) : (
          <h1 className="font-display text-2xl font-semibold text-ink">
            {selectedCommodity.name}
            <span className="text-ink-muted"> in </span>
            {selectedMarket.name}, {selectedMarket.state}
          </h1>
        )}
      </div>

      {/* Hero row: current price, deviation from baseline, spike risk */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summary.status === "ok" ? (
          <MetricCard
            label="Current price"
            emphasis
            value={`₹${Math.round(summary.data.data.currentPrice).toLocaleString("en-IN")}`}
            unit={`per quintal, ${formatDate(summary.data.data.currentDate)}`}
          />
        ) : summary.status === "error" && summary.notFound ? (
          <MetricCard label="Current price" emphasis unavailableReason="No data for this pair yet" />
        ) : (
          <Card emphasis className="p-5">
            <p className="text-xs font-medium text-ink-muted">Current price</p>
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-paper-sunken" />
          </Card>
        )}

        {summary.status === "ok" ? (
          <MetricCard
            label={`Vs. ${summary.data.data.windowDays}-day average`}
            value={`${summary.data.data.deviationPct > 0 ? "+" : ""}${summary.data.data.deviationPct}%`}
            trend={summary.data.data.trend}
            trendTone={
              Math.abs(summary.data.data.deviationPct) < 5
                ? "neutral"
                : summary.data.data.deviationPct > 0
                  ? "risk"
                  : "stable"
            }
            helper={`Baseline ₹${Math.round(summary.data.data.baselineAverage).toLocaleString("en-IN")}, based on ${summary.data.data.dataPointsInWindow} day${summary.data.data.dataPointsInWindow === 1 ? "" : "s"}`}
          />
        ) : summary.status === "error" && summary.notFound ? (
          <MetricCard label="Vs. historical average" unavailableReason="No data for this pair yet" />
        ) : (
          <Card className="p-5">
            <p className="text-xs font-medium text-ink-muted">Vs. historical average</p>
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-paper-sunken" />
          </Card>
        )}

        {spikeRisk.status === "ok" && spikeRisk.data.data ? (
          <MetricCard
            label={`Spike risk (${spikeRisk.data.data.horizonDays}-day)`}
            value={`${Math.round(spikeRisk.data.data.riskProbability * 100)}%`}
            trendTone={
              spikeRisk.data.data.riskProbability >= 0.6
                ? "risk"
                : spikeRisk.data.data.riskProbability >= 0.3
                  ? "neutral"
                  : "stable"
            }
            helper="Rule-based heuristic, not a trained classifier"
          />
        ) : spikeRisk.status === "ok" || (spikeRisk.status === "error" && spikeRisk.notFound) ? (
          <MetricCard label="Spike risk" unavailableReason="Needs more price history" />
        ) : (
          <Card className="p-5">
            <p className="text-xs font-medium text-ink-muted">Spike risk</p>
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-paper-sunken" />
          </Card>
        )}
      </div>

      <PriceTrendChart
        status={chartStatus}
        stale={series.status === "ok" && Boolean(series.stale)}
        onRetry={series.status === "error" ? series.retry : undefined}
        series={seriesPoints}
        forecasts={forecast.status === "ok" ? forecast.data.data.forecasts : []}
        anomalies={anomalies.status === "ok" ? anomalies.data.data : []}
        range={range}
        onRangeChange={setRange}
        subject={subject}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* AI interpretation: styled as an analyst note, not a chat bubble */}
          <Card className="border-l-2 border-l-ink p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-medium text-ink-muted">AI interpretation</h2>
              {explanation.status === "ok" && (
                <Badge tone={explanation.data.data.source === "llm" ? "neutral" : "pending"}>
                  {explanation.data.data.source === "llm" ? "AI-generated" : "Deterministic summary"}
                </Badge>
              )}
            </div>
            {explanation.status === "ok" ? (
              <p className="mt-2 text-sm leading-relaxed text-ink">{explanation.data.data.text}</p>
            ) : explanation.status === "error" && explanation.notFound ? (
              <p className="mt-2 text-sm text-ink-muted">
                Not enough price data for this market and commodity yet to generate an explanation.
              </p>
            ) : explanation.status === "error" ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-risk">Couldn't generate an explanation.</span>
                <button type="button" onClick={explanation.retry} className="text-ink underline underline-offset-2 hover:no-underline">
                  Try again
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2" aria-busy="true" aria-label="Loading explanation">
                <div className="h-3 w-full animate-pulse rounded bg-paper-sunken" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-paper-sunken" />
              </div>
            )}
          </Card>

          {forecast.status === "ok" && forecast.data.data.evaluation?.metrics && (
            <section aria-labelledby="eval-heading">
              <div className="flex items-center justify-between gap-3">
                <h2 id="eval-heading" className="text-sm font-medium text-ink">
                  Forecast model evaluation
                </h2>
                <Badge tone="neutral">{forecast.data.data.evaluation.metrics.winner ?? forecast.data.data.evaluation.modelVersion}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-3 sm:grid-cols-4">
                {[
                  { label: "MAE", value: `₹${(forecast.data.data.evaluation.metrics.mae ?? 0).toFixed(1)}` },
                  { label: "RMSE", value: `₹${(forecast.data.data.evaluation.metrics.rmse ?? 0).toFixed(1)}` },
                  { label: "Train size", value: `${forecast.data.data.evaluation.metrics.trainSize} days` },
                  { label: "Test size", value: `${forecast.data.data.evaluation.metrics.testSize} days` },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs text-ink-muted">{item.label}</dt>
                    <dd className="font-mono text-sm text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-ink-muted">
                Evaluated on a held-out, time-ordered split. Forecasts are estimates, not guarantees.
              </p>
            </section>
          )}
        </div>

        <MoversPanel />
      </div>
    </div>
  );
}
