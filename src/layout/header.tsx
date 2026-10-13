import * as React from "react";
import { LogOut, Menu } from "lucide-react";
import { Avatar, Drawer, ThemeToggle } from "7k-design-system/react";

import { useAuth } from "@/auth/auth-context";
import { Dropdown } from "@/components/dropdown";
import { SidebarNav } from "@/layout/sidebar";
import { TenantSwitcher } from "@/layout/tenant-switcher";

export function Header() {
  const { parsedToken, logout } = useAuth();
  const name =
    (parsedToken?.["name"] as string | undefined) ??
    (parsedToken?.["preferred_username"] as string | undefined) ??
    "User";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [navOpen, setNavOpen] = React.useState(false);

  return (
    <header className="topbar">
      <button
        type="button"
        className="btn btn-ghost btn-icon topbar-hamburger"
        aria-label="Open navigation"
        onClick={() => setNavOpen(true)}
      >
        <Menu size={18} />
      </button>
      <Drawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        side="left"
        aria-label="Navigation"
      >
        <SidebarNav onNavigate={() => setNavOpen(false)} />
      </Drawer>
      <TenantSwitcher />
      <div className="topbar-spacer" />
      <ThemeToggle />
      <Dropdown
        label="User menu"
        align="end"
        trigger={
          <button type="button" className="avatar-trigger">
            <Avatar initials={initials} />
          </button>
        }
      >
        <p className="mono-label menu-section">{name}</p>
        <button type="button" role="menuitem" className="menu-item" onClick={() => logout()}>
          <LogOut size={14} aria-hidden="true" />
          Sign out
        </button>
      </Dropdown>
    </header>
  );
}
