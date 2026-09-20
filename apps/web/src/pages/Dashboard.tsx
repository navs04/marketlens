import { Card } from "../components/ui/Card";
import { MetricCard } from "../components/ui/MetricCard";
import { PriceTrendChart } from "../components/charts/PriceTrendChart";
import { useSelection } from "../context/SelectionContext";

export function Dashboard() {
  const { selectedMarket, selectedCommodity, markets, commodities } = useSelection();

  const stillLoading = markets.status === "loading" || commodities.status === "loading";
  const nothingSelected = !selectedMarket || !selectedCommodity;

  return (
    <div className="flex flex-col gap-6">
      {/* 1 & 2. What commodity, what location - this IS the page title,
          not a caption, because it's the first two things a reader needs. */}
      <div>
        {stillLoading ? (
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
        <p className="mt-1 text-sm text-ink-muted">
          Reference data is live. Price history, forecasts, and risk scoring connect over the
          next milestones — nothing below is fabricated to look complete.
        </p>
      </div>

      {/* 3, 4 & 7. Current price, how unusual it is, spike risk - the hero
          row. Each is an honest "not built yet" state, not an invented number. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Current price" emphasis pendingMilestone="Milestone 2" />
        <MetricCard label="Vs. 30-day average" pendingMilestone="Milestone 4" />
        <MetricCard label="7-day spike risk" pendingMilestone="Milestone 6" />
      </div>

      {/* 5 & 6. Historical trend and forecast, in one chart with a clear
          historical/forecast visual distinction (solid vs. dashed). */}
      <PriceTrendChart />

      {/* 8. AI interpretation - deliberately styled as an analyst note
          (left rule, not a chat bubble), and reads the structured result
          rather than inventing one, once it exists. */}
      <Card className="border-l-2 border-l-ink p-5">
        <p className="text-xs font-medium text-ink-muted">AI interpretation</p>
        <p className="mt-2 text-sm text-ink-muted">
          Once a forecast and risk score exist for this market and commodity, an LLM will
          explain that structured result in plain language here. It reads the numbers - it
          never produces them. (Milestone 6)
        </p>
      </Card>
    </div>
  );
}
