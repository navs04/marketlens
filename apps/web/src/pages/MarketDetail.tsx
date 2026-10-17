import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { StateMessage } from "../components/ui/StateMessage";
import { useMarketCommodities } from "../hooks/useMarketDetail";
import { selectionPath } from "../lib/selectionLink";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useMarketCommodities(id ?? null);

  if (detail.status === "loading" || detail.status === "idle") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading market">
        <div className="h-8 w-64 animate-pulse rounded bg-paper-sunken" />
        <div className="h-48 animate-pulse rounded-md bg-paper-sunken" />
      </div>
    );
  }

  if (detail.status === "error") {
    return (
      <Card>
        {detail.notFound ? (
          <StateMessage kind="empty" title="Market not found" action={{ label: "Back to markets", onClick: () => navigate("/markets") }}>
            This market may have been removed, or the link is out of date.
          </StateMessage>
        ) : (
          <StateMessage kind="error" title="Couldn't load this market" action={{ label: "Try again", onClick: detail.retry }}>
            The data service didn't respond. Check that the API is running, then try again.
          </StateMessage>
        )}
      </Card>
    );
  }

  const { market, commodities } = detail.data.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/markets" className="text-xs text-ink-muted hover:text-ink hover:underline">
          Markets
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{market.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {market.district ? `${market.district}, ` : ""}
          {market.state}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">Source: {market.source}</p>
      </div>

      <section aria-labelledby="reported-heading">
        <h2 id="reported-heading" className="mb-2 text-sm font-medium text-ink">
          Commodities reported at this market
        </h2>
        <Card className="overflow-hidden">
          {commodities.length === 0 ? (
            <StateMessage kind="empty" title="No price data for this market yet">
              Prices appear here once this market's records have been ingested.
            </StateMessage>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                    <th className="px-4 py-2.5 font-medium sm:px-5">Commodity</th>
                    <th className="num px-4 py-2.5 font-medium sm:px-5">Latest price</th>
                    <th className="num hidden px-4 py-2.5 font-medium sm:table-cell sm:px-5">As of</th>
                  </tr>
                </thead>
                <tbody>
                  {commodities.map((entry) => {
                    const to = selectionPath("/", { marketId: market.id, commodityId: entry.commodity.id });
                    return (
                      <tr
                        key={entry.commodity.id}
                        className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-paper-sunken"
                        onClick={() => navigate(to)}
                      >
                        <td className="px-4 py-2.5 sm:px-5">
                          <Link to={to} className="font-medium text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                            {entry.commodity.name}
                          </Link>
                          <p className="text-xs text-ink-muted sm:hidden">{formatDate(entry.latestDate)}</p>
                        </td>
                        <td className="num px-4 py-2.5 font-mono text-ink sm:px-5">
                          ₹{Math.round(entry.latestPrice).toLocaleString("en-IN")} <span className="text-xs text-ink-muted">{entry.commodity.unit}</span>
                        </td>
                        <td className="num hidden px-4 py-2.5 font-mono text-xs text-ink-muted sm:table-cell sm:px-5">
                          {formatDate(entry.latestDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
