import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { SelectionProvider } from "./context/SelectionContext";
import { Dashboard } from "./pages/Dashboard";
import { Markets } from "./pages/Markets";
import { Commodities } from "./pages/Commodities";
import { Alerts } from "./pages/Alerts";

export function App() {
  return (
    <SelectionProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/commodities" element={<Commodities />} />
          <Route path="/alerts" element={<Alerts />} />
        </Routes>
      </AppShell>
    </SelectionProvider>
  );
}
