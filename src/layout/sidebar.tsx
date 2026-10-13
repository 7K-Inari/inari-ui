import { NavLink } from "react-router-dom";
import { Badge, ProjectIcon, Tooltip } from "7k-design-system/react";

import { listApprovalsInbox } from "@/api/approvals";
import { listClusters } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import { ExtensionNavItems } from "@/ext/slots";
import { NAV_SECTIONS } from "@/layout/nav";
import { tenantLink } from "@/tenant/tenant-link";
import { useTenant } from "@/tenant/tenant-context";

function useNavCounts(tenant: string, enabled = true) {
  const { data: approvals } = useAsyncResource(
    (token) => listApprovalsInbox(token),
    [tenant],
    { refetchIntervalMs: 30_000, enabled },
  );
  const { data: clusters } = useAsyncResource(
    (token) => listClusters(token, tenant),
    [tenant],
    { refetchIntervalMs: 30_000, enabled },
  );
  return {
    pendingApprovals: approvals?.length ?? 0,
    degradedClusters: (clusters ?? []).filter((c) => c.status === "degraded").length,
  };
}

interface NavCounts {
  pendingApprovals: number;
  degradedClusters: number;
}

export function SidebarNav({
  onNavigate,
  counts,
}: {
  onNavigate?: () => void;
  counts?: NavCounts;
}) {
  const { tenant } = useTenant();
  const ownCounts = useNavCounts(tenant, !counts);
  const effectiveCounts = counts ?? ownCounts;

  const badgeFor = (path: string) => {
    if (path === "approvals" && effectiveCounts.pendingApprovals > 0)
      return <Badge variant="warning">{effectiveCounts.pendingApprovals}</Badge>;
    if (path === "clusters" && effectiveCounts.degradedClusters > 0)
      return <Badge variant="danger">{effectiveCounts.degradedClusters}</Badge>;
    return null;
  };

  return (
    <>
      <div className="sidebar-logo">
        <ProjectIcon size={24} />
        <span className="sidebar-wordmark">INARI</span>
      </div>
      <nav className="nav nav-vertical sidebar-nav" aria-label="Primary">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.title ?? `section-${i}`} className="sidebar-group">
            {section.title && (
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
                    aria-label={item.label}
                  >
                    <item.icon size={16} aria-hidden="true" />
                    <span className="sidebar-item-label">{item.label}</span>
                    {badge && <span className="sidebar-item-badge">{badge}</span>}
                  </NavLink>
                );
                return (
                  <li key={item.path}>
                    <Tooltip
                      content={item.label}
                      position="right"
                      style={{ display: "block", width: "100%" }}
                    >
                      {link}
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="sidebar-group sidebar-extensions">
          <p className="mono-label sidebar-group-label">Extensions</p>
          <ExtensionNavItems tenant={tenant} onNavigate={onNavigate} />
        </div>
      </nav>
    </>
  );
}

export function Sidebar() {
  const { tenant } = useTenant();
  const counts = useNavCounts(tenant);
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <SidebarNav counts={counts} />
    </aside>
  );
}
