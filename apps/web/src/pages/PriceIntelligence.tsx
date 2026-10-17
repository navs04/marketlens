import { Link, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Sparkline } from "../components/ui/Sparkline";
import { StateMessage } from "../components/ui/StateMessage";
import { useAnomalyFeed, useSpikeRiskFeed } from "../hooks/useFeeds";
import { pairKey, useSparklines } from "../hooks/useSparklines";
import { selectionPath } from "../lib/selectionLink";
import { sparkFor, windowOf } from "../lib/sparkline";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

const th = "px-4 py-2.5 font-medium sm:px-5";
const td = "px-4 py-2.5 sm:px-5";

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-5" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-paper-sunken" />
      ))}
    </div>
  );
}

export function PriceIntelligence() {
  const navigate = useNavigate();
  const anomalies = useAnomalyFeed(50);
  const spikeRisk = useSpikeRiskFeed(50, 0.4);

  const anomalyRows = anomalies.status === "ok" ? anomalies.data.data : [];
  const riskRows = spikeRisk.status === "ok" ? spikeRisk.data.data : [];
  const sparklines = useSparklines([
    ...anomalyRows.map((a) => ({ marketId: a.market.id, commodityId: a.commodity.id })),
    ...riskRows.map((s) => ({ marketId: s.market.id, commodityId: s.commodity.id })),
  ]);
  const sparkWindow = sparklines.status === "ok" ? windowOf(sparklines.data.data) : null;
  const seriesFor = (marketId: string, commodityId: string) =>
    sparkFor(sparklines.status === "ok" ? (sparklines.data.data.series[pairKey({ marketId, commodityId })] ?? []) : [], sparkWindow);
  const domain: [number, number] | undefined = sparkWindow ? [sparkWindow.start, sparkWindow.end] : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Price intelligence</h1>
        <p className="mt-1 text-sm text-ink-muted">Unusual price movements and elevated spike risk across every tracked market.</p>
      </div>

      <section aria-labelledby="anomalies-heading">
        <h2 id="anomalies-heading" className="mb-2 text-sm font-medium text-ink">
          Recent anomalies
        </h2>
        <Card className="overflow-hidden">
          {anomalies.status === "loading" || anomalies.status === "idle" ? (
            <TableSkeleton />
          ) : anomalies.status === "error" ? (
            <StateMessage kind="error" title="Couldn't load anomalies" action={{ label: "Try again", onClick: anomalies.retry }}>
              The data service didn't respond. Check that the API is running, then try again.
            </StateMessage>
          ) : anomalyRows.length === 0 ? (
            <StateMessage kind="empty" title="No anomalies detected yet">
              This fills in after the anomaly-detection job has run on enough price history. See ml/README.md.
            </StateMessage>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                    <th className={th}>Commodity</th>
                    <th className={`${th} hidden sm:table-cell`}>Market</th>
                    <th className={`${th} hidden md:table-cell`}>Date</th>
                    <th className={`${th} num`}>Observed</th>
                    <th className={`${th} num hidden md:table-cell`}>Expected</th>
                    <th className={`${th} num`}>Deviation</th>
                    <th className={`${th} num hidden lg:table-cell`}>30-day trend</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalyRows.map((a) => (
                    <tr
                      key={a.id}
                      className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-paper-sunken"
                      onClick={() => navigate(selectionPath("/", { marketId: a.market.id, commodityId: a.commodity.id }))}
                    >
                      <td className={td}>
                        <Link
                          to={selectionPath("/", { marketId: a.market.id, commodityId: a.commodity.id })}
                          className="font-medium text-ink hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.commodity.name}
                        </Link>
                        <p className="text-xs text-ink-muted sm:hidden">
                          {a.market.name}, {a.market.state}
                        </p>
                      </td>
                      <td className={`${td} hidden text-ink-muted sm:table-cell`}>
                        {a.market.name}, {a.market.state}
                      </td>
                      <td className={`${td} hidden font-mono text-xs text-ink-muted md:table-cell`}>{formatDate(a.date)}</td>
                      <td className={`${td} num font-mono text-ink`}>₹{Math.round(a.observedPrice).toLocaleString("en-IN")}</td>
                      <td className={`${td} num hidden font-mono text-ink-muted md:table-cell`}>
                        ₹{Math.round(a.expectedPrice).toLocaleString("en-IN")}
                      </td>
                      <td className={`${td} num`}>
                        <Badge tone={a.deviationPct > 0 ? "risk" : "stable"}>
                          {a.deviationPct > 0 ? "+" : ""}
                          {Math.round(a.deviationPct)}%
                        </Badge>
                      </td>
                      <td className={`${td} hidden lg:table-cell`}>
                        <div className="flex justify-end">
                          <Sparkline {...seriesFor(a.market.id, a.commodity.id)} domain={domain} label={`${a.commodity.name} 30-day price trend`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="risk-heading">
        <h2 id="risk-heading" className="mb-2 text-sm font-medium text-ink">
          Elevated spike risk
        </h2>
        <Card className="overflow-hidden">
          {spikeRisk.status === "loading" || spikeRisk.status === "idle" ? (
            <TableSkeleton />
          ) : spikeRisk.status === "error" ? (
            <StateMessage kind="error" title="Couldn't load spike risk" action={{ label: "Try again", onClick: spikeRisk.retry }}>
              The data service didn't respond. Check that the API is running, then try again.
            </StateMessage>
          ) : riskRows.length === 0 ? (
            <StateMessage kind="empty" title="No pairs currently show elevated risk">
              Pairs appear here when their heuristic spike-risk score reaches 40% or more.
            </StateMessage>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                    <th className={th}>Commodity</th>
                    <th className={`${th} hidden sm:table-cell`}>Market</th>
                    <th className={`${th} hidden md:table-cell`}>As of</th>
                    <th className={`${th} num`}>Risk (next {riskRows[0]?.horizonDays ?? 7}d)</th>
                    <th className={`${th} num hidden lg:table-cell`}>30-day trend</th>
                  </tr>
                </thead>
                <tbody>
                  {riskRows.map((s) => (
                    <tr
                      key={`${s.market.id}-${s.commodity.id}`}
                      className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-paper-sunken"
                      onClick={() => navigate(selectionPath("/", { marketId: s.market.id, commodityId: s.commodity.id }))}
                    >
                      <td className={td}>
                        <Link
                          to={selectionPath("/", { marketId: s.market.id, commodityId: s.commodity.id })}
                          className="font-medium text-ink hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.commodity.name}
                        </Link>
                        <p className="text-xs text-ink-muted sm:hidden">
                          {s.market.name}, {s.market.state}
                        </p>
                      </td>
                      <td className={`${td} hidden text-ink-muted sm:table-cell`}>
                        {s.market.name}, {s.market.state}
                      </td>
                      <td className={`${td} hidden font-mono text-xs text-ink-muted md:table-cell`}>{formatDate(s.asOfDate)}</td>
                      <td className={`${td} num`}>
                        <Badge tone={s.riskProbability >= 0.6 ? "risk" : "neutral"}>{Math.round(s.riskProbability * 100)}%</Badge>
                      </td>
                      <td className={`${td} hidden lg:table-cell`}>
                        <div className="flex justify-end">
                          <Sparkline {...seriesFor(s.market.id, s.commodity.id)} domain={domain} label={`${s.commodity.name} 30-day price trend`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
