import { Badge } from "../ui/Badge";
import { useApiHealth } from "../../hooks/useApiHealth";
import { useSelection } from "../../context/SelectionContext";

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function Topbar() {
  const health = useApiHealth();
  const { markets, commodities, selectedMarket, selectedCommodity, selectMarketId, selectCommodityId } =
    useSelection();

  return (
    <header className="flex items-center justify-between gap-6 border-b border-line bg-paper-raised px-6 py-3.5">
      <div className="flex items-center gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-ink-muted">Commodity</span>
          <select
            className="min-w-40 rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink disabled:text-ink-faint"
            disabled={commodities.status !== "ok"}
            value={selectedCommodity?.id ?? ""}
            onChange={(e) => selectCommodityId(e.target.value)}
          >
            {commodities.status === "ok" ? (
              commodities.items.map((commodity) => (
                <option key={commodity.id} value={commodity.id}>
                  {commodity.name}
                </option>
              ))
            ) : (
              <option>{commodities.status === "loading" ? "Loading" : "Unavailable"}</option>
            )}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-ink-muted">Market</span>
          <select
            className="min-w-44 rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink disabled:text-ink-faint"
            disabled={markets.status !== "ok"}
            value={selectedMarket?.id ?? ""}
            onChange={(e) => selectMarketId(e.target.value)}
          >
            {markets.status === "ok" ? (
              markets.items.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.name}, {market.state}
                </option>
              ))
            ) : (
              <option>{markets.status === "loading" ? "Loading" : "Unavailable"}</option>
            )}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs text-ink-muted">As of {todayLabel()}</span>
        {health.status === "ok" && <Badge tone="stable">API connected</Badge>}
        {health.status === "loading" && <Badge tone="pending">Checking API</Badge>}
        {health.status === "error" && <Badge tone="risk">API unreachable</Badge>}
      </div>
    </header>
  );
}
