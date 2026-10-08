import { NavLink } from "react-router-dom";
import { Badge, ProjectIcon, Tooltip } from "7k-design-system/react";

import { listApprovalsInbox } from "@/api/approvals";
import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import { ExtensionNavItems } from "@/ext/slots";
import { NAV_SECTIONS } from "@/layout/nav";
import { tenantLink } from "@/tenant/tenant-link";
import { useTenant } from "@/tenant/tenant-context";

function useNavCounts(tenant: string) {
  const { data: approvals } = useAsyncResource(
    (token) => listApprovalsInbox(token),
    [tenant],
    { refetchIntervalMs: 30_000 },
  );
  const { data: clusters } = useAsyncResource(
    (token) => listClusters(token, tenant),
    [tenant],
    { refetchIntervalMs: 30_000 },
  );
  return {
    pendingApprovals: approvals?.length ?? 0,
    degradedClusters: (clusters ?? []).filter((c) => c.status === "degraded").length,
  };
}

export function SidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { tenant } = useTenant();
  const counts = useNavCounts(tenant);

  const badgeFor = (path: string) => {
    if (path === "approvals" && counts.pendingApprovals > 0)
      return <Badge variant="warning">{counts.pendingApprovals}</Badge>;
    if (path === "clusters" && counts.degradedClusters > 0)
      return <Badge variant="danger">{counts.degradedClusters}</Badge>;
    return null;
  };

  return (
    <>
      <div className="sidebar-logo">
        <ProjectIcon size={24} />
        {!collapsed && <span className="sidebar-wordmark">INARI</span>}
      </div>
      <nav className="nav nav-vertical sidebar-nav" aria-label="Primary">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.title ?? `section-${i}`} className="sidebar-group">
            {section.title && !collapsed && (
              <p className="mono-label sidebar-group-label">{section.title}</p>
            )}
            <ul>
              {section.items.map((item) => {
                const badge = badgeFor(item.path);
                const link = (
                  <NavLink
                    to={tenantLink(tenant, item.path)}
                    onClick={onNavigate}
                    end={item.path === "overview"}
                    className={({ isActive }) =>
                      `nav-item nav-item-accent${isActive ? " active" : ""}`
                    }
                    aria-label={collapsed ? item.label : undefined}
                  >
                    <item.icon size={16} aria-hidden="true" />
                    {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
                    {!collapsed && badge && <span className="sidebar-item-badge">{badge}</span>}
                  </NavLink>
                );
                return (
                  <li key={item.path}>
                    {collapsed ? (
                      <Tooltip content={item.label}>{link}</Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {!collapsed && (
          <div className="sidebar-group sidebar-extensions">
            <p className="mono-label sidebar-group-label">Extensions</p>
            <ExtensionNavItems tenant={tenant} onNavigate={onNavigate} />
          </div>
        )}
      </nav>
    </>
  );
}

export function Sidebar() {
  return (
    <>
      <aside className="sidebar sidebar-full" aria-label="Sidebar">
        <SidebarNav />
      </aside>
      <aside className="sidebar sidebar-rail" aria-label="Sidebar">
        <SidebarNav collapsed />
      </aside>
    </>
  );
}
