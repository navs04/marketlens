import { Link } from "react-router-dom";
import { StateMessage } from "../ui/StateMessage";
import { useMovers } from "../../hooks/useMovers";
import { selectionPath } from "../../lib/selectionLink";
import type { Mover } from "../../api/types";

function MoverRow({ mover, direction }: { mover: Mover; direction: "up" | "down" }) {
  const tone = direction === "up" ? "text-risk" : "text-stable";
  return (
    <li>
      <Link
        to={selectionPath("/", { commodityId: mover.commodity.id })}
        className="group flex items-baseline justify-between gap-3 rounded px-1 py-2 transition-colors hover:bg-paper-sunken"
      >
        <span className="flex items-baseline gap-2 text-sm text-ink">
          <span aria-hidden className={`text-[10px] ${tone}`}>
            {direction === "up" ? "▲" : "▼"}
          </span>
          <span className="group-hover:underline">{mover.commodity.name}</span>
          <span className="sr-only">{direction === "up" ? "rising" : "falling"}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className={`font-mono text-sm font-medium ${tone}`}>
            {mover.changePct > 0 ? "+" : ""}
            {mover.changePct.toFixed(1)}%
          </span>
          <span className="text-[11px] text-ink-faint">{mover.markets} markets</span>
        </span>
      </Link>
    </li>
  );
}

export function MoversPanel() {
  const movers = useMovers(7, 4);

  const formattedDate =
    movers.status === "ok" && movers.data.data.asOf
      ? new Date(movers.data.data.asOf).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })
      : null;

  return (
    <section aria-labelledby="movers-heading" className="border-t border-line pt-4 lg:border-t-0 lg:pt-0">
      <h2 id="movers-heading" className="text-sm font-medium text-ink">
        Biggest movers
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        Median price change vs. the prior {movers.status === "ok" ? movers.data.data.windowDays : 7} days of data
        {formattedDate ? `, as of ${formattedDate}` : ""}. Only markets reporting in both periods count.
      </p>

      {movers.status === "loading" || movers.status === "idle" ? (
        <div className="mt-3 flex flex-col gap-2" aria-busy="true" aria-label="Loading movers">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-paper-sunken" />
          ))}
        </div>
      ) : movers.status === "error" ? (
        <StateMessage compact kind="error" title="Couldn't load movers" action={{ label: "Try again", onClick: movers.retry }} />
      ) : movers.data.data.risers.length === 0 && movers.data.data.fallers.length === 0 ? (
        <StateMessage compact kind="empty" title="Not enough overlapping data yet">
          Movers need at least {movers.data.data.minMarkets} markets reporting a commodity in both periods.
        </StateMessage>
      ) : (
        <div className="mt-2">
          {movers.data.data.risers.length > 0 && (
            <ul className="divide-y divide-line" aria-label="Rising prices">
              {movers.data.data.risers.map((m) => (
                <MoverRow key={m.commodity.id} mover={m} direction="up" />
              ))}
            </ul>
          )}
          {movers.data.data.fallers.length > 0 && (
            <ul
              className={`divide-y divide-line ${movers.data.data.risers.length > 0 ? "mt-1 border-t border-line" : ""}`}
              aria-label="Falling prices"
            >
              {movers.data.data.fallers.map((m) => (
                <MoverRow key={m.commodity.id} mover={m} direction="down" />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
