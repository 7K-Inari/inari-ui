import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { parseOrganizations, type Organization } from "@/auth/orgs";
import { ALL_TENANTS, isValidTenant } from "@/tenant/tenant-link";
import { setCurrentTenant } from "@/tenant/current";

const RECENTS_KEY = "inari-tenant-recents";
const MAX_RECENTS = 5;

export interface TenantState {
  tenant: string;
  team: string | null;
  orgs: Organization[];
  recents: string[];
  setTenant: (tenant: string) => void;
  setTeam: (team: string | null) => void;
}

const TenantContext = React.createContext<TenantState | null>(null);

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(recents: string[], tenant: string): string[] {
  if (tenant === ALL_TENANTS) return recents;
  return [tenant, ...recents.filter((r) => r !== tenant)].slice(0, MAX_RECENTS);
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { parsedToken } = useAuth();
  const params = useParams<{ tenant: string }>();
  const navigate = useNavigate();

  const orgs = React.useMemo(() => parseOrganizations(parsedToken), [parsedToken]);
  const orgIds = React.useMemo(() => orgs.map((o) => o.id), [orgs]);

  const paramTenant = params.tenant ?? ALL_TENANTS;
  const valid = isValidTenant(paramTenant, orgIds);
  const tenant = valid ? paramTenant : ALL_TENANTS;

  const [team, setTeam] = React.useState<string | null>(null);
  const [recents, setRecents] = React.useState<string[]>(readRecents);

  React.useEffect(() => {
    if (!valid) {
      navigate(`/${ALL_TENANTS}/overview`, { replace: true });
    }
  }, [valid, navigate]);

  React.useEffect(() => {
    if (valid && tenant !== ALL_TENANTS) {
      setRecents((prev) => {
        const next = pushRecent(prev, tenant);
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [tenant, valid]);

  React.useEffect(() => {
    setCurrentTenant(tenant);
  }, [tenant]);

  React.useEffect(() => {
    setTeam(null);
  }, [tenant]);

  const setTenant = React.useCallback(
    (next: string) => {
      navigate(`/${next}/overview`);
    },
    [navigate],
  );

  const value: TenantState = {
    tenant,
    team,
    orgs,
    recents,
    setTenant,
    setTeam,
  };

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantState {
  const ctx = React.useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
