import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { useSelection } from "../context/SelectionContext";
import { useMarketCommodities } from "../hooks/useMarketDetail";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectMarketId, selectCommodityId } = useSelection();
  const detail = useMarketCommodities(id ?? null);

  function openInDashboard(commodityId: string) {
    if (!id) return;
    selectMarketId(id);
    selectCommodityId(commodityId);
    navigate("/");
  }

  if (detail.status === "loading" || detail.status === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-64 animate-pulse rounded bg-paper-sunken" />
        <div className="h-48 animate-pulse rounded-md bg-paper-sunken" />
      </div>
    );
  }

  if (detail.status === "error") {
    return (
      <Card className="p-5 text-sm text-risk">
        {detail.notFound ? "Market not found." : `Could not load market: ${detail.message}`}
      </Card>
    );
  }

  const { market, commodities } = detail.data.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{market.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {market.district ? `${market.district}, ` : ""}
          {market.state}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">Source: {market.source}</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Commodities reported at this market</p>
        <Card className="overflow-hidden">
          {commodities.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">No price data for this market yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                  <th className="px-5 py-2.5 font-medium">Commodity</th>
                  <th className="px-5 py-2.5 font-medium">Latest price</th>
                  <th className="px-5 py-2.5 font-medium">As of</th>
                </tr>
              </thead>
              <tbody>
                {commodities.map((entry) => (
                  <tr
                    key={entry.commodity.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-sunken"
                    onClick={() => openInDashboard(entry.commodity.id)}
                  >
                    <td className="px-5 py-2.5 font-medium text-ink">{entry.commodity.name}</td>
                    <td className="px-5 py-2.5 font-mono text-ink">
                      ₹{entry.latestPrice} <span className="text-xs text-ink-muted">{entry.commodity.unit}</span>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-ink-muted">{formatDate(entry.latestDate)}</td>
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
