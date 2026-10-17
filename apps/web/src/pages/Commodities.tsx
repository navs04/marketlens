import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { StateMessage } from "../components/ui/StateMessage";
import { useCommodities } from "../hooks/useReferenceData";
import { selectionPath } from "../lib/selectionLink";

export function Commodities() {
  const commodities = useCommodities();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (commodities.status !== "ok") return [];
    const q = query.trim().toLowerCase();
    return q ? commodities.items.filter((c) => c.name.toLowerCase().includes(q)) : commodities.items;
  }, [commodities, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Commodities</h1>
          <p className="mt-1 text-sm text-ink-muted">Every commodity with ingested price data. Select one to open it in the overview.</p>
        </div>
        <label className="w-full sm:w-72">
          <span className="sr-only">Filter commodities</span>
          <input
            type="search"
            placeholder="Filter by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong"
          />
        </label>
      </div>

      <Card className="overflow-hidden">
        {commodities.status === "loading" ? (
          <div className="flex flex-col gap-2 p-5" aria-busy="true" aria-label="Loading commodities">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-paper-sunken" />
            ))}
          </div>
        ) : commodities.status === "error" ? (
          <StateMessage kind="error" title="Couldn't load commodities">
            The data service didn't respond. Check that the API is running, then reload the page.
          </StateMessage>
        ) : filtered.length === 0 ? (
          <StateMessage kind="empty" title={query ? `No commodities match “${query}”` : "No commodities yet"}>
            {query ? "Check the spelling or clear the filter." : "Commodities appear here after price data has been ingested."}
          </StateMessage>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                  <th className="px-4 py-2.5 font-medium sm:px-5">Commodity</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell sm:px-5">Category</th>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Unit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((commodity) => (
                  <tr key={commodity.id} className="border-b border-line transition-colors last:border-0 hover:bg-paper-sunken">
                    <td className="px-4 py-2.5 sm:px-5">
                      <Link to={selectionPath("/", { commodityId: commodity.id })} className="font-medium text-ink hover:underline">
                        {commodity.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2.5 sm:table-cell sm:px-5">
                      <Badge tone="neutral">{commodity.category}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-muted sm:px-5">{commodity.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
