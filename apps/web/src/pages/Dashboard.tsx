import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { MetricCard } from "../components/ui/MetricCard";
import { PriceTrendChart } from "../components/charts/PriceTrendChart";
import { useSelection } from "../context/SelectionContext";
import { useOverview } from "../hooks/useOverview";
import {
  useAnomalyHistory,
  useExplanation,
  useForecast,
  usePriceHistory,
  usePriceSummary,
  useSpikeRisk,
} from "../hooks/usePriceIntelligence";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function OverviewRow() {
  const overview = useOverview();

  if (overview.status === "loading" || overview.status === "idle") {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-paper-sunken" />
        ))}
      </div>
    );
  }

  if (overview.status === "error") {
    return (
      <Card className="p-4 text-sm text-risk">Could not load overview stats: {overview.message}</Card>
    );
  }

  const { data } = overview.data;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card className="p-4">
        <p className="text-xs text-ink-muted">Commodities tracked</p>
        <p className="font-mono text-xl font-medium text-ink">{data.commoditiesTracked}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-ink-muted">Markets tracked</p>
        <p className="font-mono text-xl font-medium text-ink">{data.marketsTracked}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-ink-muted">Latest data</p>
        <p className="font-mono text-xl font-medium text-ink">{formatDate(data.latestDataDate)}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-ink-muted">Anomalies detected</p>
        <p className="font-mono text-xl font-medium text-ink">{data.anomaliesDetected}</p>
      </Card>
    </div>
  );
}

export function Dashboard() {
  const { selectedMarket, selectedCommodity, markets, commodities } = useSelection();
  const pair = { marketId: selectedMarket?.id ?? null, commodityId: selectedCommodity?.id ?? null };

  const summary = usePriceSummary(pair);
  const history = usePriceHistory(pair, 90);
  const forecast = useForecast(pair);
  const anomalies = useAnomalyHistory(pair, 90);
  const spikeRisk = useSpikeRisk(pair);
  const explanation = useExplanation(pair);

  const stillLoadingSelection = markets.status === "loading" || commodities.status === "loading";
  const nothingSelected = !selectedMarket || !selectedCommodity;

  return (
    <div className="flex flex-col gap-6">
      <OverviewRow />

      <div>
        {stillLoadingSelection ? (
          <div className="h-8 w-72 animate-pulse rounded bg-paper-sunken" />
        ) : nothingSelected ? (
          <h1 className="font-display text-2xl font-semibold text-ink">
            Select a commodity and market to begin
          </h1>
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
            value={`₹${summary.data.data.currentPrice}`}
            unit={`as of ${formatDate(summary.data.data.currentDate)}`}
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
            helper={`Baseline ₹${summary.data.data.baselineAverage} - based on ${summary.data.data.dataPointsInWindow} day${summary.data.data.dataPointsInWindow === 1 ? "" : "s"}`}
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
            helper="Rule-based heuristic, not a trained classifier - see docs"
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
        history={history.status === "ok" ? history.data.data : []}
        forecasts={forecast.status === "ok" ? forecast.data.data.forecasts : []}
        anomalies={anomalies.status === "ok" ? anomalies.data.data : []}
      />

      {/* Forecast evaluation panel */}
      {forecast.status === "ok" && forecast.data.data.evaluation?.metrics && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-ink-muted">Forecast model evaluation</p>
            <Badge tone="neutral">{forecast.data.data.evaluation.metrics.winner ?? forecast.data.data.evaluation.modelVersion}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-ink-muted">MAE</p>
              <p className="font-mono text-sm text-ink">₹{forecast.data.data.evaluation.metrics.mae}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">RMSE</p>
              <p className="font-mono text-sm text-ink">₹{forecast.data.data.evaluation.metrics.rmse}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Train size</p>
              <p className="font-mono text-sm text-ink">{forecast.data.data.evaluation.metrics.trainSize} days</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Test size</p>
              <p className="font-mono text-sm text-ink">{forecast.data.data.evaluation.metrics.testSize} days</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Evaluated on a held-out, time-ordered split - predictions are estimates, not guarantees.
          </p>
        </Card>
      )}

      {/* AI interpretation */}
      <Card className="border-l-2 border-l-ink p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-ink-muted">AI interpretation</p>
          {explanation.status === "ok" && (
            <Badge tone={explanation.data.data.source === "llm" ? "neutral" : "pending"}>
              {explanation.data.data.source === "llm" ? "AI-generated" : "Deterministic summary"}
            </Badge>
          )}
        </div>
        {explanation.status === "ok" ? (
          <p className="mt-2 text-sm text-ink">{explanation.data.data.text}</p>
        ) : explanation.status === "error" && explanation.notFound ? (
          <p className="mt-2 text-sm text-ink-muted">
            Not enough price data for this market and commodity yet to generate an explanation.
          </p>
        ) : explanation.status === "error" ? (
          <p className="mt-2 text-sm text-risk">Could not generate an explanation: {explanation.message}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <div className="h-3 w-full animate-pulse rounded bg-paper-sunken" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-paper-sunken" />
          </div>
        )}
      </Card>
    </div>
  );
}
