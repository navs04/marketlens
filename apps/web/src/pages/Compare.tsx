import { Link, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Sparkline } from "../components/ui/Sparkline";
import { StateMessage } from "../components/ui/StateMessage";
import { useSelection } from "../context/SelectionContext";
import { useMarketComparison } from "../hooks/useMarketComparison";
import { useMarketStates } from "../hooks/useMarketDetail";
import { pairKey, useSparklines } from "../hooks/useSparklines";
import { sparkFor, windowOf } from "../lib/sparkline";
import { selectionPath } from "../lib/selectionLink";

const selectClass =
  "min-w-44 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong";

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });

export function Compare() {
  const { commodities, selectedCommodity, selectCommodityId } = useSelection();
  const states = useMarketStates();
  const [searchParams, setSearchParams] = useSearchParams();
  const stateFilter = searchParams.get("state");

  const setStateFilter = (value: string) =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value) params.set("state", value);
      else params.delete("state");
      return params;
    });

  const comparison = useMarketComparison(selectedCommodity?.id ?? null, stateFilter);
  const entries = comparison.status === "ok" ? comparison.data.data : [];

  const sparklines = useSparklines(
    entries.map((e) => ({ marketId: e.market.id, commodityId: selectedCommodity?.id ?? "" })),
    30,
  );

  const sparkWindow = sparklines.status === "ok" ? windowOf(sparklines.data.data) : null;

  const maxPrice = entries.length > 0 ? Math.max(...entries.map((r) => r.price)) : 0;
  const newestDate = entries.length > 0 ? entries.reduce((a, b) => (a.date > b.date ? a : b)).date : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Compare markets</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Latest price for one commodity across the markets that report it. Showing the {entries.length > 0 ? `top ${entries.length}` : "top 20"} by price.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-ink-muted">Commodity</span>
          <select
            className={selectClass}
            disabled={commodities.status !== "ok"}
            value={selectedCommodity?.id ?? ""}
            onChange={(e) => selectCommodityId(e.target.value)}
          >
            {commodities.status === "ok" &&
              commodities.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-ink-muted">State (optional)</span>
          <select className={selectClass} value={stateFilter ?? ""} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">All states</option>
            {states.status === "ok" &&
              states.data.data.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>
        </label>
      </div>

      <Card className="p-5">
        {comparison.status === "loading" || comparison.status === "idle" ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading comparison">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-paper-sunken" />
            ))}
          </div>
        ) : comparison.status === "error" ? (
          <StateMessage kind="error" title="Couldn't load the comparison" action={{ label: "Try again", onClick: comparison.retry }}>
            The data service didn't respond. Check that the API is running, then try again.
          </StateMessage>
        ) : entries.length === 0 ? (
          <StateMessage kind="empty" title={`No markets report ${selectedCommodity?.name ?? "this commodity"}${stateFilter ? ` in ${stateFilter}` : ""}`}>
            {stateFilter ? "Try “All states”, or pick a different commodity." : "Pick a different commodity from the selector above."}
          </StateMessage>
        ) : (
          <>
            <div className="mb-2 hidden items-center gap-3 text-[11px] font-medium text-ink-muted sm:flex">
              <span className="w-44 shrink-0">Market</span>
              <span className="flex-1">Latest price</span>
              <span className="w-16 text-right">30-day</span>
              <span className="w-[84px] text-right">Trend</span>
            </div>
            <ol className="flex flex-col">
              {entries.map((entry) => {
                const series = sparklines.status === "ok" ? (sparklines.data.data.series[pairKey({ marketId: entry.market.id, commodityId: selectedCommodity?.id ?? "" })] ?? []) : [];
                const { values, times, change } = sparkFor(series, sparkWindow);
                const stale = newestDate !== null && entry.date < newestDate;
                return (
                  <li key={entry.market.id} className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
                    <Link
                      to={selectionPath("/", { marketId: entry.market.id, commodityId: selectedCommodity?.id })}
                      className="w-32 shrink-0 truncate text-sm text-ink hover:underline sm:w-44"
                      title={`${entry.market.name}, ${entry.market.state}`}
                    >
                      {entry.market.name}
                      <span className="text-ink-muted">, {entry.market.state}</span>
                    </Link>
                    <div className="relative h-4 min-w-0 flex-1 rounded-sm bg-paper-sunken" aria-hidden>
                      <div className="h-full rounded-sm bg-accent/80" style={{ width: `${maxPrice > 0 ? (entry.price / maxPrice) * 100 : 0}%` }} />
                    </div>
                    <div className="w-20 shrink-0 text-right">
                      <p className="font-mono text-sm text-ink">₹{Math.round(entry.price).toLocaleString("en-IN")}</p>
                      {stale && <p className="text-[11px] text-ink-faint">as of {dayLabel(entry.date)}</p>}
                    </div>
                    <div className="hidden w-16 shrink-0 text-right font-mono text-xs sm:block">
                      {change === null ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        <span className={change > 0.5 ? "text-risk" : change < -0.5 ? "text-stable" : "text-ink-muted"}>
                          {change > 0 ? "+" : ""}
                          {change.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="hidden shrink-0 sm:block">
                      <Sparkline values={values} times={times} domain={sparkWindow ? [sparkWindow.start, sparkWindow.end] : undefined} label={`${entry.market.name} 30-day price trend`} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
              Trend lines use daily average prices over the 30 days ending at the newest date among these markets, drawn on a shared time scale. A market's 30-day change is shown only when its data spans that window.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
