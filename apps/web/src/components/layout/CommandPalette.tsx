import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelection } from "../../context/SelectionContext";
import { selectionPath } from "../../lib/selectionLink";

interface PaletteItem {
  id: string;
  group: "Go to" | "Commodities" | "Markets";
  label: string;
  hint?: string;
  run: () => void;
}

const PAGES = [
  { to: "/", label: "Overview", keepSelection: true },
  { to: "/compare", label: "Compare markets", keepSelection: true },
  { to: "/price-intelligence", label: "Price intelligence", keepSelection: false },
  { to: "/markets", label: "Markets", keepSelection: false },
  { to: "/commodities", label: "Commodities", keepSelection: false },
  { to: "/alerts", label: "Alerts", keepSelection: false },
];

const MAX_PER_GROUP = 6;

/** Prefix matches rank ahead of mid-string matches. */
function rank(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  if (h.startsWith(needle)) return 0;
  if (h.includes(needle)) return 1;
  return -1;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { markets, commodities, selectedMarket, selectedCommodity, selectionQuery } = useSelection();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Wait a frame so the input exists before focusing it.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const needle = query.trim().toLowerCase();
    const go = (path: string) => () => {
      onClose();
      navigate(path);
    };

    const pages: PaletteItem[] = PAGES.filter((p) => !needle || p.label.toLowerCase().includes(needle)).map((p) => ({
      id: `page:${p.to}`,
      group: "Go to",
      label: p.label,
      run: go(p.keepSelection ? `${p.to}${selectionQuery}` : p.to),
    }));

    if (!needle) return pages;

    const commodityItems: PaletteItem[] =
      commodities.status === "ok"
        ? commodities.items
            .map((c) => ({ c, r: rank(c.name, needle) }))
            .filter((x) => x.r >= 0)
            .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
            .slice(0, MAX_PER_GROUP)
            .map(({ c }) => ({
              id: `commodity:${c.id}`,
              group: "Commodities" as const,
              label: c.name,
              hint: "Show in overview",
              run: go(selectionPath("/", { marketId: selectedMarket?.id, commodityId: c.id })),
            }))
        : [];

    const marketItems: PaletteItem[] =
      markets.status === "ok"
        ? markets.items
            .map((m) => {
              const byName = rank(m.name, needle);
              // A match on district/state ranks below any match on the name.
              const byPlace = rank(`${m.district ?? ""} ${m.state}`, needle) >= 0 ? 2 : -1;
              return { m, r: byName >= 0 ? byName : byPlace };
            })
            .filter((x) => x.r >= 0)
            .sort((a, b) => a.r - b.r || a.m.name.localeCompare(b.m.name))
            .slice(0, MAX_PER_GROUP)
            .map(({ m }) => ({
              id: `market:${m.id}`,
              group: "Markets" as const,
              label: m.name,
              hint: [m.district, m.state].filter(Boolean).join(", "),
              run: go(selectionPath("/", { marketId: m.id, commodityId: selectedCommodity?.id })),
            }))
        : [];

    return [...pages, ...commodityItems, ...marketItems];
  }, [query, commodities, markets, selectedMarket, selectedCommodity, selectionQuery, navigate, onClose]);

  // Keep the highlighted row valid as results change.
  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[active]?.run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      event.preventDefault(); // keep focus inside the dialog
    }
  }

  let lastGroup: string | null = null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search markets, commodities, and pages"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-paper-raised shadow-lg"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets, commodities, or pages"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[active] ? `palette-${items[active]!.id}` : undefined}
          aria-autocomplete="list"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">No matches for “{query}”.</li>
          ) : (
            items.map((item, index) => {
              const showHeading = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <li key={item.id} role="presentation">
                  {showHeading && <p className="px-4 pb-1 pt-2.5 text-[11px] font-medium text-ink-muted">{item.group}</p>}
                  <div
                    id={`palette-${item.id}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={() => item.run()}
                    className={`mx-1.5 flex cursor-pointer items-baseline justify-between gap-4 rounded-md px-2.5 py-2 text-sm ${
                      index === active ? "bg-accent-soft text-accent-strong" : "text-ink"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint && <span className={`shrink-0 text-xs ${index === active ? "text-accent-strong" : "text-ink-muted"}`}>{item.hint}</span>}
                  </div>
                </li>
              );
            })
          )}
        </ul>
        <p className="border-t border-line px-4 py-2 text-[11px] text-ink-muted">
          <span className="font-mono">↑↓</span> to move, <span className="font-mono">Enter</span> to open, <span className="font-mono">Esc</span> to close
        </p>
      </div>
    </div>
  );
}
