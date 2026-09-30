import * as React from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { getRbacMatrix, putTeamRoleMappings } from "@/api/rbac";
import { listRoles } from "@/api/roles";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { teamDisplayName } from "@/pages/access/role-catalog";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { resolveTenant } from "@/tenant/current";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

// Sentinel for the per-row "No role" option: a team with no mapping holds no
// tenant ClusterRole.
const NO_ROLE = "";
// Sentinel prefix for a mapping whose ClusterRole matches no role entity
// (custom role deleted elsewhere, or the roles list failed to load). The
// remainder is the role name recovered from the ClusterRole suffix. Rendered
// as a disabled "Unknown role" option so a Save can never silently drop the
// mapping: it round-trips the name as the roleId (the write accepts names).
const UNKNOWN_PREFIX = "unknown:";

function unknownName(value: string): string | null {
  return value.startsWith(UNKNOWN_PREFIX) ? value.slice(UNKNOWN_PREFIX.length) : null;
}

const selectClass =
  "flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm";

// Role engine (ADR-0013): rows are teams, the per-row select lists the org's
// role entities (built-in + custom from GET /roles) and the write is the
// generalized team→roleId bulk PUT. The read projection still speaks
// synthesized ClusterRole names (`tenant-<slug>-<role.Name>`), so current
// assignments are recovered by stripping the tenant prefix and matching the
// role by name.
export function RoleMatrix() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canManageRbac } = useOrgCapabilities();
  const {
    data: matrix,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => getRbacMatrix(t, tenant), [tenant]);
  const {
    data: roles,
    loading: rolesLoading,
    error: rolesError,
  } = useAsyncResource((t) => listRoles(t, tenant), [tenant]);

  const roleByName = React.useMemo(
    () => new Map((roles ?? []).map((r) => [r.name, r])),
    [roles],
  );
  // Without the role entities the per-row selects cannot resolve a single
  // row — and Save is a whole-set replace that would unmap every team.
  const rolesReady = roles !== undefined;

  // Draft state: one roleId per team. null = pristine, mirrors the server
  // state. The draft is tagged with its tenant: a tenant switch re-renders
  // without unmounting, and a stale draft from the previous tenant would
  // otherwise show every team as "No role" and wipe the new tenant's
  // mappings on Save.
  const [draftState, setDraftState] = React.useState<{
    tenant: string;
    values: Record<string, string>;
  } | null>(null);
  const draft = draftState && draftState.tenant === tenant ? draftState.values : null;
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const effective = React.useMemo(() => {
    if (draft) return draft;
    const base: Record<string, string> = {};
    const prefix = `tenant-${resolveTenant(tenant)}-`;
    for (const group of matrix?.groups ?? []) {
      const clusterRole =
        matrix?.mappings.find((m) => m.groupPath === group.path)?.clusterRole ??
        "";
      const name = clusterRole.startsWith(prefix)
        ? clusterRole.slice(prefix.length)
        : clusterRole;
      if (clusterRole === "") {
        base[group.path] = NO_ROLE;
      } else {
        const match = roleByName.get(name);
        // Unknown ClusterRole: keep the mapping addressable via the sentinel
        // so it round-trips on Save instead of being silently unmapped.
        base[group.path] = match ? match.id : UNKNOWN_PREFIX + name;
      }
    }
    return base;
  }, [draft, matrix, roleByName, tenant]);
  const dirty = draft !== null;

  const select = (groupPath: string, roleId: string) => {
    setDraftState({ tenant, values: { ...effective, [groupPath]: roleId } });
    setActionError(null);
  };

  const save = async () => {
    if (!draft || !matrix || !rolesReady) return;
    setSaving(true);
    setActionError(null);
    // Whole-set replace: exactly one mapping per team, teams on "No role"
    // are omitted (unmapped). Unknown roles round-trip their recovered name
    // as the roleId so the write never silently drops them.
    const mappings = matrix.groups
      .map((g) => {
        const value = draft[g.path] ?? NO_ROLE;
        return { team: g.team, roleId: unknownName(value) ?? value };
      })
      .filter((m) => m.roleId !== NO_ROLE);
    try {
      await putTeamRoleMappings(token, tenant, mappings);
      setDraftState(null);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save role assignments",
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraftState(null);
    setActionError(null);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Failed to load role assignments: {error.message}
        </CardContent>
      </Card>
    );
  }
  if (rolesError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Failed to load roles: {rolesError.message}
        </CardContent>
      </Card>
    );
  }
  if ((loading && !matrix) || rolesLoading && !roles) {
    return <p className="text-sm text-muted-foreground">Loading role assignments…</p>;
  }
  if (!matrix || matrix.groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No teams in this organization.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Assign each team a role. Saving applies all assignments in one
          request. <Link to={tenantLink(tenant, "access/roles")} className="underline">Manage roles</Link>
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
              Discard
            </Button>
          )}
          <CapabilityGate capability="manageRbac" mode="disable">
            <Button onClick={save} disabled={!dirty || saving || !rolesReady}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </CapabilityGate>
        </div>
      </div>

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Team</th>
              <th className="px-4 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {matrix.groups.map((group) => {
              const display = teamDisplayName(group);
              const value = effective[group.path] ?? NO_ROLE;
              const unknown = unknownName(value);
              const role = (roles ?? []).find((r) => r.id === value);
              return (
                <tr key={group.path} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <span className="font-medium">{display}</span>{" "}
                    <Badge variant="muted">{group.memberCount} members</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      aria-label={`Role for ${display}`}
                      className={selectClass}
                      value={value}
                      disabled={!canManageRbac || saving || !rolesReady}
                      title={
                        unknown
                          ? `No role entity matches "${unknown}"; the mapping is preserved on save`
                          : role?.description || undefined
                      }
                      onChange={(e) => select(group.path, e.target.value)}
                    >
                      <option value={NO_ROLE}>No role</option>
                      {unknown && (
                        <option value={value} disabled>
                          Unknown role ({unknown})
                        </option>
                      )}
                      {(roles ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.displayName || r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
