import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/markets", label: "Markets" },
  { to: "/commodities", label: "Commodities" },
  { to: "/alerts", label: "Alerts" },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-paper px-4 py-6">
      <div className="mb-8 px-2">
        <span className="font-display text-xl font-semibold text-ink">MarketLens</span>
        <p className="mt-0.5 text-xs text-ink-muted">Price intelligence</p>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent-soft text-accent-strong"
                  : "text-ink-muted hover:bg-paper-raised hover:text-ink"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-3 pt-6 text-xs text-ink-faint">
        <p>Development build</p>
        <p className="font-mono">Milestone 1</p>
      </div>
    </aside>
  );
}
