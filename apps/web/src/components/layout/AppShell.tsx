import type { PropsWithChildren } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
