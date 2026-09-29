import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  getRbacMatrix,
  putRbacMappings,
  type RbacMapping,
} from "@/api/rbac";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { roleDisplay, teamDisplayName } from "@/pages/access/role-catalog";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { useTenant } from "@/tenant/tenant-context";

// Sentinel for the per-row "No role" radio option: a team with no mapping
// holds no tenant ClusterRole.
const NO_ROLE = "";

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

  // Draft state: one role per team (radio semantics — the server rejects
  // duplicate teams with 400). null = pristine, mirrors the server state.
  const [draft, setDraft] = React.useState<Record<string, string> | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const effective = React.useMemo(() => {
    if (draft) return draft;
    const base: Record<string, string> = {};
    for (const group of matrix?.groups ?? []) {
      base[group.path] =
        matrix?.mappings.find((m) => m.groupPath === group.path)?.clusterRole ??
        NO_ROLE;
    }
    return base;
  }, [draft, matrix]);
  const dirty = draft !== null;

  const select = (groupPath: string, clusterRole: string) => {
    setDraft({ ...effective, [groupPath]: clusterRole });
    setActionError(null);
  };

  const save = async () => {
    if (!draft || !matrix) return;
    setSaving(true);
    setActionError(null);
    // Whole-set replace: exactly one mapping per team, teams on "No role"
    // are omitted (unmapped).
    const mappings: RbacMapping[] = matrix.groups
      .map((g) => ({ groupPath: g.path, clusterRole: draft[g.path] ?? NO_ROLE }))
      .filter((m) => m.clusterRole !== NO_ROLE);
    try {
      await putRbacMappings(token, tenant, mappings);
      setDraft(null);
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
    setDraft(null);
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
  if (loading && !matrix) {
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
          Assign each team a role. Saving applies all assignments in one request.
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
              Discard
            </Button>
          )}
          <CapabilityGate capability="manageRbac" mode="disable">
            <Button onClick={save} disabled={!dirty || saving}>
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
              <th className="px-4 py-2 font-medium">No role</th>
              {matrix.roles.map((role) => {
                const display = roleDisplay(role);
                return (
                  <th
                    key={role.name}
                    className="px-4 py-2 font-medium"
                    title={display.description || role.name}
                  >
                    {display.name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {matrix.groups.map((group) => (
              <tr key={group.path} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2">
                  <span className="font-medium">{teamDisplayName(group)}</span>{" "}
                  <Badge variant="muted">{group.memberCount} members</Badge>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="radio"
                    name={`role-${group.path}`}
                    className="h-4 w-4 border-input accent-primary"
                    aria-label={`${teamDisplayName(group)}: No role`}
                    checked={(effective[group.path] ?? NO_ROLE) === NO_ROLE}
                    disabled={!canManageRbac || saving}
                    onChange={() => select(group.path, NO_ROLE)}
                  />
                </td>
                {matrix.roles.map((role) => {
                  const display = roleDisplay(role);
                  return (
                    <td key={role.name} className="px-4 py-2">
                      <input
                        type="radio"
                        name={`role-${group.path}`}
                        className="h-4 w-4 border-input accent-primary"
                        aria-label={`${teamDisplayName(group)}: ${display.name}`}
                        title={display.description || role.name}
                        checked={effective[group.path] === role.name}
                        disabled={!canManageRbac || saving}
                        onChange={() => select(group.path, role.name)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
