import { NavLink } from "react-router-dom";
import { useSelection } from "../../context/SelectionContext";

// `keepSelection`: these pages are driven by the selected market/commodity,
// so their links carry the current choice in the query string.
const navItems = [
  { to: "/", label: "Overview", end: true, keepSelection: true },
  { to: "/compare", label: "Compare markets", keepSelection: true },
  { to: "/price-intelligence", label: "Price intelligence" },
  { to: "/markets", label: "Markets" },
  { to: "/commodities", label: "Commodities" },
  { to: "/alerts", label: "Alerts" },
];

interface SidebarProps {
  /** Mobile drawer state. On large screens the sidebar is always visible. */
  open: boolean;
  isDesktop: boolean;
  onClose: () => void;
}

export function Sidebar({ open, isDesktop, onClose }: SidebarProps) {
  const { selectionQuery } = useSelection();
  const hidden = !isDesktop && !open;

  return (
    <>
      {!isDesktop && open && (
        <div className="fixed inset-0 z-30 bg-ink/30" aria-hidden onClick={onClose} />
      )}
      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        // `inert` keeps the off-screen drawer out of the tab order and
        // accessibility tree while it's closed.
        inert={hidden}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-line bg-paper px-4 py-6 transition-transform duration-200 lg:static lg:z-auto lg:w-56 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-start justify-between px-2">
          <div>
            <span className="font-display text-xl font-semibold text-ink">MarketLens</span>
            <p className="mt-0.5 text-xs text-ink-muted">Price intelligence</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mr-1 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-paper-raised hover:text-ink lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search: item.keepSelection ? selectionQuery : "" }}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors lg:py-1.5 ${
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
        </div>
      </aside>
    </>
  );
}
