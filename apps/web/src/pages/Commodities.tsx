import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useCommodities } from "../hooks/useReferenceData";

export function Commodities() {
  const commodities = useCommodities();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (commodities.status !== "ok") return [];
    const q = query.trim().toLowerCase();
    if (!q) return commodities.items;
    return commodities.items.filter((c) => c.name.toLowerCase().includes(q));
  }, [commodities, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Commodities</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Reference commodities currently seeded in the database.
          </p>
        </div>
        <input
          type="search"
          placeholder="Filter by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-72 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
        />
      </div>

      <Card className="overflow-hidden">
        {commodities.status === "loading" && (
          <p className="p-5 text-sm text-ink-muted">Loading commodities…</p>
        )}
        {commodities.status === "error" && (
          <p className="p-5 text-sm text-risk">{commodities.message}</p>
        )}
        {commodities.status === "ok" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                <th className="px-5 py-2.5 font-medium">Commodity</th>
                <th className="px-5 py-2.5 font-medium">Category</th>
                <th className="px-5 py-2.5 font-medium">Unit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((commodity) => (
                <tr key={commodity.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-2.5 font-medium text-ink">{commodity.name}</td>
                  <td className="px-5 py-2.5">
                    <Badge tone="neutral">{commodity.category}</Badge>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-muted">
                    {commodity.unit}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-ink-muted">
                    No commodities match "{query}"
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
