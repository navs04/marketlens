import { useState } from "react";
import { Card } from "../components/ui/Card";
import { useSelection } from "../context/SelectionContext";
import { useMarketComparison } from "../hooks/useMarketComparison";
import { useMarketStates } from "../hooks/useMarketDetail";

export function Compare() {
  const { commodities, selectedCommodity, selectCommodityId } = useSelection();
  const states = useMarketStates();
  const [stateFilter, setStateFilter] = useState<string | null>(null);

  const comparison = useMarketComparison(selectedCommodity?.id ?? null, stateFilter);

  const maxPrice =
    comparison.status === "ok" && comparison.data.data.length > 0
      ? Math.max(...comparison.data.data.map((r) => r.price))
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Compare markets</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Latest price for one commodity across every market that has reported it.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-ink-muted">Commodity</span>
          <select
            className="min-w-48 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm font-medium text-ink"
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
          <select
            className="min-w-44 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink"
            value={stateFilter ?? ""}
            onChange={(e) => setStateFilter(e.target.value || null)}
          >
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
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-paper-sunken" />
            ))}
          </div>
        ) : comparison.status === "error" ? (
          <p className="text-sm text-risk">Could not load comparison: {comparison.message}</p>
        ) : comparison.data.data.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No markets have reported a price for this commodity{stateFilter ? ` in ${stateFilter}` : ""} yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {comparison.data.data.map((entry) => (
              <div key={entry.market.id} className="flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-sm text-ink" title={`${entry.market.name}, ${entry.market.state}`}>
                  {entry.market.name}
                  <span className="text-ink-muted">, {entry.market.state}</span>
                </div>
                <div className="relative h-5 flex-1 rounded-sm bg-paper-sunken">
                  <div
                    className="h-full rounded-sm bg-accent"
                    style={{ width: `${maxPrice > 0 ? (entry.price / maxPrice) * 100 : 0}%` }}
                  />
                </div>
                <div className="w-20 shrink-0 text-right font-mono text-sm text-ink">₹{entry.price}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
