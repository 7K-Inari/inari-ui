import { Building2, Check, ChevronsUpDown, Globe, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { canCreateOrganizations } from "@/auth/roles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALL_TENANTS } from "@/tenant/tenant-link";
import { useTenant } from "@/tenant/tenant-context";

const PLACEHOLDER_TEAMS = ["platform", "apps", "data"];

export function TenantSwitcher() {
  const { tenant, team, orgs, recents, setTenant, setTeam } = useTenant();
  const { parsedToken } = useAuth();
  const navigate = useNavigate();

  const activeOrg = orgs.find((o) => o.id === tenant);
  const label =
    tenant === ALL_TENANTS
      ? "All tenants"
      : (activeOrg?.name ?? tenant) + (team ? ` / ${team}` : "");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-56 justify-between"
          aria-label="Tenant context switcher"
        >
          <span className="flex items-center gap-2 truncate">
            {tenant === ALL_TENANTS ? <Globe /> : <Building2 />}
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuItem onSelect={() => setTenant(ALL_TENANTS)}>
          <Globe />
          All tenants
          {tenant === ALL_TENANTS && <Check className="ml-auto" />}
        </DropdownMenuItem>
        {recents.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {recents.map((id) => {
              const org = orgs.find((o) => o.id === id);
              if (!org) return null;
              return (
                <DropdownMenuItem key={id} onSelect={() => setTenant(id)}>
                  <Building2 />
                  {org.name}
                  {tenant === id && <Check className="ml-auto" />}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {orgs.map((org) => (
          <DropdownMenuItem key={org.id} onSelect={() => setTenant(org.id)}>
            <Building2 />
            {org.name}
            {tenant === org.id && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        {orgs.length === 0 && (
          <DropdownMenuItem disabled>No organizations</DropdownMenuItem>
        )}
        {canCreateOrganizations(parsedToken) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/create-organization")}>
              <Plus />
              Create organization
            </DropdownMenuItem>
          </>
        )}
        {tenant !== ALL_TENANTS && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Team scope</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setTeam(null)}>
              Whole organization
              {team === null && <Check className="ml-auto" />}
            </DropdownMenuItem>
            {PLACEHOLDER_TEAMS.map((t) => (
              <DropdownMenuItem key={t} onSelect={() => setTeam(t)}>
                {t}
                {team === t && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
