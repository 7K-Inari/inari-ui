import { Building2, Check, ChevronsUpDown, Globe, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { usePermissions } from "@/auth/permissions-context";
import { Dropdown } from "@/components/dropdown";
import { ALL_TENANTS } from "@/tenant/tenant-link";
import { useTenant } from "@/tenant/tenant-context";

const PLACEHOLDER_TEAMS = ["platform", "apps", "data"];

export function TenantSwitcher() {
  const { tenant, team, orgs, recents, setTenant, setTeam } = useTenant();
  const { canCreateOrganizations } = usePermissions();
  const navigate = useNavigate();

  const activeOrg = orgs.find((o) => o.id === tenant);
  const label =
    tenant === ALL_TENANTS
      ? "All tenants"
      : `${activeOrg?.name ?? tenant}${team ? ` / ${team}` : ""}`;

  const item = (
    onSelect: () => void,
    active: boolean,
    icon: React.ReactNode,
    text: string,
  ) => (
    <button type="button" role="menuitem" className="menu-item" onClick={onSelect}>
      {icon}
      <span className="tenant-switcher-item-label">{text}</span>
      {active && <Check size={14} className="tenant-switcher-check" aria-hidden="true" />}
    </button>
  );

  return (
    <Dropdown
      label="Tenant context switcher"
      className="tenant-switcher"
      trigger={
        <button type="button" className="btn btn-ghost tenant-switcher-trigger">
          {tenant === ALL_TENANTS ? <Globe size={16} /> : <Building2 size={16} />}
          <span className="mono-label tenant-switcher-label">{label}</span>
          <ChevronsUpDown size={14} aria-hidden="true" />
        </button>
      }
    >
      {(close) => (
        <>
          <p className="mono-label menu-section">All tenants</p>
          {item(
            () => {
              setTenant(ALL_TENANTS);
              close();
            },
            tenant === ALL_TENANTS,
            <Globe size={14} aria-hidden="true" />,
            "All tenants",
          )}
          {recents.length > 0 && (
            <>
              <p className="mono-label menu-section">Recent</p>
              {recents.map((id) => {
                const org = orgs.find((o) => o.id === id);
                if (!org) return null;
                return (
                  <span key={id}>
                    {item(
                      () => {
                        setTenant(id);
                        close();
                      },
                      tenant === id,
                      <Building2 size={14} aria-hidden="true" />,
                      org.name,
                    )}
                  </span>
                );
              })}
            </>
          )}
          <p className="mono-label menu-section">Organizations</p>
          {orgs.map((org) => (
            <span key={org.id}>
              {item(
                () => {
                  setTenant(org.id);
                  close();
                },
                tenant === org.id,
                <Building2 size={14} aria-hidden="true" />,
                org.name,
              )}
            </span>
          ))}
          {orgs.length === 0 && (
            <button type="button" className="menu-item" disabled>
              No organizations
            </button>
          )}
          {canCreateOrganizations && (
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                navigate("/create-organization");
                close();
              }}
            >
              <Plus size={14} aria-hidden="true" />
              Create organization
            </button>
          )}
          {tenant !== ALL_TENANTS && (
            <>
              <p className="mono-label menu-section">Team scope</p>
              {item(
                () => {
                  setTeam(null);
                  close();
                },
                team === null,
                <span className="tenant-switcher-spacer" />,
                "Whole organization",
              )}
              {PLACEHOLDER_TEAMS.map((t) => (
                <span key={t}>
                  {item(
                    () => {
                      setTeam(t);
                      close();
                    },
                    team === t,
                    <span className="tenant-switcher-spacer" />,
                    t,
                  )}
                </span>
              ))}
            </>
          )}
        </>
      )}
    </Dropdown>
  );
}
