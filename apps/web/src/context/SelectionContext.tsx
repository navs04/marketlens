import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from "react";
import { useSearchParams } from "react-router-dom";
import { useCommodities, useMarkets } from "../hooks/useReferenceData";
import type { Commodity, Market } from "../api/types";

interface SelectionContextValue {
  markets: ReturnType<typeof useMarkets>;
  commodities: ReturnType<typeof useCommodities>;
  selectedMarket: Market | null;
  selectedCommodity: Commodity | null;
  selectMarketId: (id: string) => void;
  selectCommodityId: (id: string) => void;
  /** Query string ("?market=..&commodity=..") for whatever the user has
   *  explicitly chosen, so navigation links can carry the selection along. */
  selectionQuery: string;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * The URL is the source of truth for the selected market/commodity
 * (`?market=<id>&commodity=<id>`), so a refresh, a shared link, and the
 * browser's back/forward buttons all behave naturally. When nothing has
 * been chosen explicitly the first item of each list is used as a default,
 * without writing it to the URL - the URL only ever records real choices.
 */
export function SelectionProvider({ children }: PropsWithChildren) {
  const markets = useMarkets();
  const commodities = useCommodities();
  const [searchParams, setSearchParams] = useSearchParams();

  const marketParam = searchParams.get("market");
  const commodityParam = searchParams.get("commodity");

  const selectedMarket = useMemo(() => {
    if (markets.status !== "ok" || markets.items.length === 0) return null;
    return markets.items.find((m) => m.id === marketParam) ?? markets.items[0]!;
  }, [markets, marketParam]);

  const selectedCommodity = useMemo(() => {
    if (commodities.status !== "ok" || commodities.items.length === 0) return null;
    return commodities.items.find((c) => c.id === commodityParam) ?? commodities.items[0]!;
  }, [commodities, commodityParam]);

  const setParam = useCallback(
    (key: "market" | "commodity", id: string) => {
      // Functional update: other pages keep their own params (range, page,
      // search...) in the same query string, so never overwrite wholesale.
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, id);
        return next;
      });
    },
    [setSearchParams],
  );

  const selectionQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (marketParam) params.set("market", marketParam);
    if (commodityParam) params.set("commodity", commodityParam);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [marketParam, commodityParam]);

  return (
    <SelectionContext.Provider
      value={{
        markets,
        commodities,
        selectedMarket,
        selectedCommodity,
        selectMarketId: (id) => setParam("market", id),
        selectCommodityId: (id) => setParam("commodity", id),
        selectionQuery,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within a SelectionProvider");
  return ctx;
}
