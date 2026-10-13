import { NavLink, Outlet } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { visibleSettingsSections } from "@/pages/settings/settings-nav";
import { useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS } from "@/tenant/tenant-link";

export function SettingsLayout() {
  const { tenant } = useTenant();
  const { isAdmin } = useOrgCapabilities();

  if (tenant === ALL_TENANTS) {
    return (
      <div className="stack">
        <PageHeader
          breadcrumb="Govern / Settings"
          title="Settings"
          lede="Select a specific tenant to manage its settings — every settings endpoint is tenant-scoped."
        />
      </div>
    );
  }

  const sections = visibleSettingsSections(isAdmin);

  return (
    <div className="settings-layout">
      <nav aria-label="Settings" className="nav nav-vertical settings-nav">
        {sections.map((section) => (
          <div key={section.title} className="sidebar-group">
            <p className="mono-label sidebar-group-label">{section.title}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === "" || item.path === "org"}
                    className={({ isActive }) =>
                      `nav-item nav-item-accent${isActive ? " active" : ""}`
                    }
                  >
                    <item.icon size={16} aria-hidden="true" />
                    <span className="sidebar-item-label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="settings-content">
        <Outlet />
      </div>
    </div>
  );
}
