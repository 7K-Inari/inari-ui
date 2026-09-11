import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { visibleSettingsSections } from "@/pages/settings/settings-nav";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS } from "@/tenant/tenant-link";

export function SettingsLayout() {
  const { tenant } = useTenant();
  const { isAdmin } = useOrgCapabilities();

  if (tenant === ALL_TENANTS) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Select a specific tenant to manage its settings — every settings
          endpoint is tenant-scoped.
        </p>
      </div>
    );
  }

  const sections = visibleSettingsSections(isAdmin);

  return (
    <div className="flex gap-6">
      <nav
        aria-label="Settings"
        className="w-52 shrink-0 space-y-4 border-r pr-4"
      >
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                        isActive && "bg-accent font-medium text-accent-foreground",
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
