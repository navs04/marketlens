import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useCommodities, useMarkets } from "../hooks/useReferenceData";
import type { Commodity, Market } from "../api/types";

interface SelectionContextValue {
  markets: ReturnType<typeof useMarkets>;
  commodities: ReturnType<typeof useCommodities>;
  selectedMarket: Market | null;
  selectedCommodity: Commodity | null;
  selectMarketId: (id: string) => void;
  selectCommodityId: (id: string) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: PropsWithChildren) {
  const markets = useMarkets();
  const commodities = useCommodities();

  const [marketId, setMarketId] = useState<string | null>(null);
  const [commodityId, setCommodityId] = useState<string | null>(null);

  // Default to the first item once each list loads, so the dashboard has a
  // real selection on first paint rather than an empty state.
  useEffect(() => {
    if (markets.status === "ok" && marketId === null && markets.items.length > 0) {
      setMarketId(markets.items[0]!.id);
    }
  }, [markets, marketId]);

  useEffect(() => {
    if (commodities.status === "ok" && commodityId === null && commodities.items.length > 0) {
      setCommodityId(commodities.items[0]!.id);
    }
  }, [commodities, commodityId]);

  const selectedMarket =
    markets.status === "ok" ? (markets.items.find((m) => m.id === marketId) ?? null) : null;
  const selectedCommodity =
    commodities.status === "ok"
      ? (commodities.items.find((c) => c.id === commodityId) ?? null)
      : null;

  return (
    <SelectionContext.Provider
      value={{
        markets,
        commodities,
        selectedMarket,
        selectedCommodity,
        selectMarketId: setMarketId,
        selectCommodityId: setCommodityId,
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
