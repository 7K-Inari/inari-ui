import * as React from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { getRbacMatrix, putRbacMappings, type RbacMapping } from "@/api/rbac";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CapabilityGate } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

function key(m: RbacMapping): string {
  return `${m.groupPath}::${m.clusterRole}`;
}

export function RbacMappingSettingsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const {
    data: matrix,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => getRbacMatrix(t, tenant), [tenant]);

  const [draft, setDraft] = React.useState<Set<string> | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // The draft is derived from the fetched matrix; once the user edits, local
  // state wins until save/refetch resets it.
  const mapped = React.useMemo(
    () => draft ?? new Set((matrix?.mappings ?? []).map(key)),
    [draft, matrix],
  );
  const dirty = draft !== null;

  const toggle = (groupPath: string, clusterRole: string) => {
    const next = new Set(mapped);
    const k = `${groupPath}::${clusterRole}`;
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setDraft(next);
    setActionError(null);
  };

  const save = async () => {
    if (!draft || !matrix) return;
    setActionError(null);
    const mappings: RbacMapping[] = [...draft].map((k) => {
      const [groupPath, clusterRole] = k.split("::");
      return { groupPath, clusterRole };
    });
    try {
      await putRbacMappings(token, tenant, mappings);
      setDraft(null);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save mappings");
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="RBAC mapping"
        description="Declarative team-to-role mapping. Saving applies the whole mapping set in one request."
        actions={
          <CapabilityGate
            capability="admin"
            fallback={
              <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
            }
          >
            <Button onClick={save} disabled={!dirty}>
              Save mappings
            </Button>
          </CapabilityGate>
        }
      />

      <p className="text-xs text-muted-foreground">
        Effective access is evaluated on the{" "}
        <Link
          to={tenantLink(tenant, "rbac")}
          className="underline underline-offset-2 hover:text-foreground"
        >
          RBAC matrix
        </Link>{" "}
        page.
      </p>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load RBAC matrix: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !matrix && (
        <p className="text-sm text-muted-foreground">Loading RBAC matrix…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {matrix && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Group</th>
                {matrix.roles.map((role) => (
                  <th key={role.name} className="px-4 py-2 font-medium">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.groups.map((group) => (
                <tr key={group.path} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{group.path}</td>
                  {matrix.roles.map((role) => {
                    const on = mapped.has(`${group.path}::${role.name}`);
                    return (
                      <td key={role.name} className="px-4 py-2">
                        <CapabilityGate capability="admin">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input accent-primary"
                            aria-label={`Map ${group.path} to ${role.name}`}
                            checked={on}
                            onChange={() => toggle(group.path, role.name)}
                          />
                        </CapabilityGate>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
