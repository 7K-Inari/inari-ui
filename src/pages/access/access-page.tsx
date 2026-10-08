import { Link, useParams } from "react-router-dom";

import { Card } from "7k-design-system/react";
import { MembersTab } from "@/pages/access/members-tab";
import { RoleMatrix } from "@/pages/access/role-matrix";
import { RolesTab } from "@/pages/access/roles-tab";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const TABS = [
  { id: "members", label: "Members" },
  { id: "teams", label: "Teams & Roles" },
  { id: "roles", label: "Roles" },
  { id: "identity", label: "Identity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | undefined): value is TabId {
  return TABS.some((t) => t.id === value);
}

function IdentityTab({ tenant }: { tenant: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link to={tenantLink(tenant, "settings/identity/clients")}>
        <Card className="h-full transition-colors hover:bg-muted/30">
          <div className="card-header">
            <h2 className="mono-label">OIDC Clients</h2>
          </div>
          <div className="card-body">
            Manage OIDC clients and service accounts for this organization.
          </div>
        </Card>
      </Link>
      <Link to={tenantLink(tenant, "settings/identity/scopes")}>
        <Card className="h-full transition-colors hover:bg-muted/30">
          <div className="card-header">
            <h2 className="mono-label">Scopes</h2>
          </div>
          <div className="card-body">
            Configure audience scopes granted to organization clients.
          </div>
        </Card>
      </Link>
    </div>
  );
}

export function AccessPage() {
  const { tenant } = useTenant();
  const { tab } = useParams();
  const active: TabId = isTabId(tab) ? tab : "members";

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title="Access"
        description="Members, team roles, and identity for this organization."
      />

      <nav className="flex gap-4 border-b" aria-label="Access sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={tenantLink(tenant, `access/${t.id}`)}
            aria-current={active === t.id ? "page" : undefined}
            className={
              active === t.id
                ? "border-b-2 border-primary px-1 pb-2 text-sm font-medium"
                : "px-1 pb-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {active === "members" && <MembersTab />}
      {active === "teams" && <RoleMatrix />}
      {active === "roles" && <RolesTab />}
      {active === "identity" && <IdentityTab tenant={tenant} />}
    </div>
  );
}
