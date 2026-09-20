import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { useMarkets } from "../hooks/useReferenceData";

export function Markets() {
  const markets = useMarkets();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (markets.status !== "ok") return [];
    const q = query.trim().toLowerCase();
    if (!q) return markets.items;
    return markets.items.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.state.toLowerCase().includes(q) ||
        (m.district ?? "").toLowerCase().includes(q),
    );
  }, [markets, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Markets</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Reference markets currently seeded in the database.
          </p>
        </div>
        <input
          type="search"
          placeholder="Filter by name, state, or district"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-72 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
        />
      </div>

      <Card className="overflow-hidden">
        {markets.status === "loading" && (
          <p className="p-5 text-sm text-ink-muted">Loading markets…</p>
        )}
        {markets.status === "error" && <p className="p-5 text-sm text-risk">{markets.message}</p>}
        {markets.status === "ok" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                <th className="px-5 py-2.5 font-medium">Market</th>
                <th className="px-5 py-2.5 font-medium">District</th>
                <th className="px-5 py-2.5 font-medium">State</th>
                <th className="px-5 py-2.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((market) => (
                <tr key={market.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-2.5 font-medium text-ink">{market.name}</td>
                  <td className="px-5 py-2.5 text-ink-muted">{market.district ?? "—"}</td>
                  <td className="px-5 py-2.5 text-ink-muted">{market.state}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-faint">
                    {market.source}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-ink-muted">
                    No markets match "{query}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
