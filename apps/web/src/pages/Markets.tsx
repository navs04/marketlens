import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Pagination } from "../components/ui/Pagination";
import { StateMessage } from "../components/ui/StateMessage";
import { useMarketsPage } from "../hooks/useMarketsPage";

const PAGE_SIZE = 25;
const th = "px-4 py-2.5 font-medium sm:px-5";
const td = "px-4 py-2.5 sm:px-5";

export function Markets() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const qParam = searchParams.get("q") ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const updateParams = (mutate: (params: URLSearchParams) => void) =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      mutate(params);
      return params;
    });

  // The input keeps its own state so typing is instant; the URL (and the
  // request) only update once typing pauses. Back/forward re-sync the input.
  const [input, setInput] = useState(qParam);
  useEffect(() => setInput(qParam), [qParam]);
  useEffect(() => {
    if (input === qParam) return;
    const timer = setTimeout(() => {
      updateParams((params) => {
        if (input) params.set("q", input);
        else params.delete("q");
        params.delete("page"); // a new search starts from page 1
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const markets = useMarketsPage(qParam, page, PAGE_SIZE);
  const setPage = (next: number) =>
    updateParams((params) => {
      if (next <= 1) params.delete("page");
      else params.set("page", String(next));
    });

  const rows = markets.status === "ok" ? markets.data.data : [];
  const meta = markets.status === "ok" ? markets.data.meta : null;
  const stale = markets.status === "ok" && Boolean(markets.stale);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Markets</h1>
          <p className="mt-1 text-sm text-ink-muted">Every market with ingested price data. Select one for details.</p>
        </div>
        <label className="w-full sm:w-72">
          <span className="sr-only">Filter markets</span>
          <input
            type="search"
            placeholder="Filter by name, state, or district"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong"
          />
        </label>
      </div>

      <Card className="overflow-hidden">
        {markets.status === "loading" || markets.status === "idle" ? (
          <div className="flex flex-col gap-2 p-5" aria-busy="true" aria-label="Loading markets">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-paper-sunken" />
            ))}
          </div>
        ) : markets.status === "error" ? (
          <StateMessage kind="error" title="Couldn't load markets" action={{ label: "Try again", onClick: markets.retry }}>
            The data service didn't respond. Check that the API is running, then try again.
          </StateMessage>
        ) : meta && meta.total === 0 ? (
          <StateMessage kind="empty" title={qParam ? `No markets match “${qParam}”` : "No markets yet"}>
            {qParam ? "Check the spelling, or try a state or district name." : "Markets appear here after price data has been ingested."}
          </StateMessage>
        ) : rows.length === 0 && meta ? (
          <StateMessage kind="empty" title="That page doesn't exist" action={{ label: "Go to the first page", onClick: () => setPage(1) }}>
            There are only {meta.totalPages} page{meta.totalPages === 1 ? "" : "s"} of results.
          </StateMessage>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity duration-150 ${stale ? "opacity-50" : "opacity-100"}`}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper-sunken text-xs text-ink-muted">
                    <th className={th}>Market</th>
                    <th className={`${th} hidden md:table-cell`}>District</th>
                    <th className={th}>State</th>
                    <th className={`${th} hidden sm:table-cell`}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((market) => (
                    <tr
                      key={market.id}
                      className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-paper-sunken"
                      onClick={() => navigate(`/markets/${market.id}`)}
                    >
                      <td className={td}>
                        <Link to={`/markets/${market.id}`} className="font-medium text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                          {market.name}
                        </Link>
                        {market.district && <p className="text-xs text-ink-muted md:hidden">{market.district}</p>}
                      </td>
                      <td className={`${td} hidden text-ink-muted md:table-cell`}>{market.district ?? "—"}</td>
                      <td className={`${td} text-ink-muted`}>{market.state}</td>
                      <td className={`${td} hidden font-mono text-xs text-ink-faint sm:table-cell`}>{market.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && <Pagination meta={meta} onPage={setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}
