import { Outlet } from "react-router-dom";

import { Header } from "@/layout/header";
import { Sidebar } from "@/layout/sidebar";

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-main">
        <Header />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
