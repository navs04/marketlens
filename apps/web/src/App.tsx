import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { SelectionProvider } from "./context/SelectionContext";

// Route-level code splitting: the Dashboard is the only page that pulls in
// the charting library, so every other page loads without it.
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Compare = lazy(() => import("./pages/Compare").then((m) => ({ default: m.Compare })));
const PriceIntelligence = lazy(() => import("./pages/PriceIntelligence").then((m) => ({ default: m.PriceIntelligence })));
const Markets = lazy(() => import("./pages/Markets").then((m) => ({ default: m.Markets })));
const MarketDetail = lazy(() => import("./pages/MarketDetail").then((m) => ({ default: m.MarketDetail })));
const Commodities = lazy(() => import("./pages/Commodities").then((m) => ({ default: m.Commodities })));
const Alerts = lazy(() => import("./pages/Alerts").then((m) => ({ default: m.Alerts })));

function PageFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-56 animate-pulse rounded bg-paper-sunken" />
      <div className="h-40 animate-pulse rounded-md bg-paper-sunken" />
    </div>
  );
}

export function App() {
  return (
    <SelectionProvider>
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/price-intelligence" element={<PriceIntelligence />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/markets/:id" element={<MarketDetail />} />
            <Route path="/commodities" element={<Commodities />} />
            <Route path="/alerts" element={<Alerts />} />
          </Routes>
        </Suspense>
      </AppShell>
    </SelectionProvider>
  );
}
