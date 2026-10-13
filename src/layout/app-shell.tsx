import { Outlet } from "react-router-dom";

import { Header } from "@/layout/header";
import { Sidebar } from "@/layout/sidebar";

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-main">
        <Header />
        {/* tabIndex: the content pane scrolls independently — keyboard users
            must be able to focus it to scroll (axe scrollable-region-focusable). */}
        <main className="app-content" tabIndex={0}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
