import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { SelectionProvider } from "./context/SelectionContext";
import { Dashboard } from "./pages/Dashboard";
import { Markets } from "./pages/Markets";
import { MarketDetail } from "./pages/MarketDetail";
import { Commodities } from "./pages/Commodities";
import { Compare } from "./pages/Compare";
import { PriceIntelligence } from "./pages/PriceIntelligence";
import { Alerts } from "./pages/Alerts";

export function App() {
  return (
    <SelectionProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/price-intelligence" element={<PriceIntelligence />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/markets/:id" element={<MarketDetail />} />
          <Route path="/commodities" element={<Commodities />} />
          <Route path="/alerts" element={<Alerts />} />
        </Routes>
      </AppShell>
    </SelectionProvider>
  );
}
