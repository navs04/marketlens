import { useEffect, useState } from "react";
import { Badge } from "../ui/Badge";
import { useApiHealth } from "../../hooks/useApiHealth";
import { useOverview } from "../../hooks/useOverview";
import { useSelection } from "../../context/SelectionContext";

interface TopbarProps {
  onMenu: () => void;
  onSearch: () => void;
}

const selectClass =
  "w-full min-w-0 rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-line-strong disabled:text-ink-faint";

export function Topbar({ onMenu, onSearch }: TopbarProps) {
  const health = useApiHealth();
  const overview = useOverview();

  // On a free-tier host the API sleeps when idle and takes up to a minute to
  // wake. If the health check is still pending after a few seconds, say so
  // rather than leaving an ambiguous "Checking".
  const [slowStart, setSlowStart] = useState(false);
  useEffect(() => {
    if (health.status !== "loading") {
      setSlowStart(false);
      return;
    }
    const timer = setTimeout(() => setSlowStart(true), 5000);
    return () => clearTimeout(timer);
  }, [health.status]);
  const { markets, commodities, selectedMarket, selectedCommodity, selectMarketId, selectCommodityId } = useSelection();

  // Shows when the DATA ends, not today's date: the dataset can be far
  // behind the calendar, and "as of today" would imply freshness it lacks.
  const dataThrough =
    overview.status === "ok" && overview.data.data.latestDataDate
      ? new Date(overview.data.data.latestDataDate).toLocaleDateString("en-IN", {
          timeZone: "UTC",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <header className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-line bg-paper-raised px-4 py-3 sm:px-6">
      <div className="flex w-full items-center justify-between lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            className="-ml-1.5 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-paper-sunken hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-display text-lg font-semibold text-ink">MarketLens</span>
        </div>
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search markets and commodities"
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-paper-sunken hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:w-auto lg:items-end">
        <label className="flex min-w-0 flex-col gap-1 lg:w-44">
          <span className="text-[11px] font-medium text-ink-muted">Commodity</span>
          <select
            className={selectClass}
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

        <label className="flex min-w-0 flex-col gap-1 lg:w-56">
          <span className="text-[11px] font-medium text-ink-muted">Market</span>
          <select
            className={selectClass}
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

      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 lg:ml-auto lg:w-auto lg:justify-end">
        <button
          type="button"
          onClick={onSearch}
          className="hidden items-center gap-2 rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink lg:inline-flex"
        >
          Search
          <kbd className="rounded border border-line bg-paper-raised px-1.5 font-mono text-[11px] text-ink-muted">Ctrl K</kbd>
        </button>
        {dataThrough && <span className="text-xs text-ink-muted">Data through {dataThrough}</span>}
        {health.status === "ok" && <Badge tone="stable">API connected</Badge>}
        {health.status === "loading" && <Badge tone="pending">{slowStart ? "Waking the server, up to a minute" : "Checking API"}</Badge>}
        {health.status === "error" && <Badge tone="risk">API unreachable</Badge>}
      </div>
    </header>
  );
}
