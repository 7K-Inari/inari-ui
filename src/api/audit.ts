import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

export interface AuditEvent {
  id: string;
  tenant: string;
  actor: string;
  action: string; // e.g. deploy.create, approval.decide, zone.vend
  objectType: string;
  objectName: string;
  detail: string;
  at: string;
}

export interface AuditFilters {
  actor?: string;
  action?: string;
  objectType?: string;
  from?: string;
  to?: string;
}

function query(filters: AuditFilters): string {
  const p = new URLSearchParams();
  if (filters.actor) p.set("actor", filters.actor);
  if (filters.action) p.set("action", filters.action);
  if (filters.objectType) p.set("objectType", filters.objectType);
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listAuditEvents(
  token: string | undefined,
  tenant: string,
  filters: AuditFilters = {},
): Promise<AuditEvent[]> {
  const res = await apiFetch<{ events: AuditEvent[] | null }>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/audit${query(filters)}`,
    { token },
  );
  return res.events ?? [];
}

export async function exportAuditEvents(
  token: string | undefined,
  tenant: string,
  filters: AuditFilters = {},
): Promise<string> {
  return apiFetch<string>(
    `/tenants/${encodeURIComponent(resolveTenant(tenant))}/audit/export${query(filters)}`,
    { token },
  );
}
