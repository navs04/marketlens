import { useEffect, useState, type PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export function AppShell({ children }: PropsWithChildren) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on navigation, and when growing to desktop.
  useEffect(() => setNavOpen(false), [location.pathname]);
  useEffect(() => {
    if (isDesktop) setNavOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === "Escape") {
        setNavOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-paper-raised focus:px-3 focus:py-2 focus:text-sm focus:shadow-sm"
      >
        Skip to content
      </a>
      <Sidebar open={navOpen} isDesktop={isDesktop} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setNavOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main id="main" className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
