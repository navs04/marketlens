import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useSelection } from "../context/SelectionContext";
import { useAnomalyFeed, useSpikeRiskFeed } from "../hooks/useFeeds";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function PriceIntelligence() {
  const navigate = useNavigate();
  const { selectMarketId, selectCommodityId } = useSelection();
  const anomalies = useAnomalyFeed(50);
  const spikeRisk = useSpikeRiskFeed(50, 0.4);

  function openInDashboard(marketId: string, commodityId: string) {
    selectMarketId(marketId);
    selectCommodityId(commodityId);
    navigate("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Price intelligence</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Unusual price movements and elevated spike risk across every tracked market.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Recent anomalies</p>
        <Card className="overflow-hidden">
          {anomalies.status === "loading" || anomalies.status === "idle" ? (
            <div className="flex flex-col gap-2 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-paper-sunken" />
              ))}
            </div>
          ) : anomalies.status === "error" ? (
            <p className="p-5 text-sm text-risk">Could not load anomalies: {anomalies.message}</p>
          ) : anomalies.data.data.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">
              No anomalies detected yet - this fills in once the anomaly-detection job has run
              against enough price history.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                  <th className="px-5 py-2.5 font-medium">Commodity</th>
                  <th className="px-5 py-2.5 font-medium">Market</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Observed</th>
                  <th className="px-5 py-2.5 font-medium">Expected</th>
                  <th className="px-5 py-2.5 font-medium">Deviation</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.data.data.map((a) => (
                  <tr
                    key={a.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-sunken"
                    onClick={() => openInDashboard(a.market.id, a.commodity.id)}
                  >
                    <td className="px-5 py-2.5 font-medium text-ink">{a.commodity.name}</td>
                    <td className="px-5 py-2.5 text-ink-muted">
                      {a.market.name}, {a.market.state}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-ink-muted">{formatDate(a.date)}</td>
                    <td className="px-5 py-2.5 font-mono text-ink">₹{Math.round(a.observedPrice)}</td>
                    <td className="px-5 py-2.5 font-mono text-ink-muted">₹{Math.round(a.expectedPrice)}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone={a.deviationPct > 0 ? "risk" : "stable"}>
                        {a.deviationPct > 0 ? "+" : ""}
                        {Math.round(a.deviationPct)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Elevated spike risk</p>
        <Card className="overflow-hidden">
          {spikeRisk.status === "loading" || spikeRisk.status === "idle" ? (
            <div className="flex flex-col gap-2 p-5">
              {[0, 1].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-paper-sunken" />
              ))}
            </div>
          ) : spikeRisk.status === "error" ? (
            <p className="p-5 text-sm text-risk">Could not load spike risk: {spikeRisk.message}</p>
          ) : spikeRisk.data.data.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">
              No market/commodity pairs currently show elevated spike risk.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                  <th className="px-5 py-2.5 font-medium">Commodity</th>
                  <th className="px-5 py-2.5 font-medium">Market</th>
                  <th className="px-5 py-2.5 font-medium">As of</th>
                  <th className="px-5 py-2.5 font-medium">Risk (next {spikeRisk.data.data[0]?.horizonDays ?? 7}d)</th>
                </tr>
              </thead>
              <tbody>
                {spikeRisk.data.data.map((s) => (
                  <tr
                    key={`${s.market.id}-${s.commodity.id}`}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-sunken"
                    onClick={() => openInDashboard(s.market.id, s.commodity.id)}
                  >
                    <td className="px-5 py-2.5 font-medium text-ink">{s.commodity.name}</td>
                    <td className="px-5 py-2.5 text-ink-muted">
                      {s.market.name}, {s.market.state}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-ink-muted">{formatDate(s.asOfDate)}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone={s.riskProbability >= 0.6 ? "risk" : "neutral"}>
                        {Math.round(s.riskProbability * 100)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
