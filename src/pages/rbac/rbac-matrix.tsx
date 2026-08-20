import { Check, Info, Loader2 } from "lucide-react";
import * as React from "react";

import { getRbacMatrix, setRbacMapping } from "@/api/rbac";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTenant } from "@/tenant/tenant-context";

export function RbacMatrixPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { data: matrix, loading, error, refetch } = useAsyncResource(
    (t) => getRbacMatrix(t, tenant),
    [tenant],
  );
  const [pendingCell, setPendingCell] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const mappings = React.useMemo(
    () => new Set((matrix?.mappings ?? []).map((m) => `${m.groupPath}::${m.clusterRole}`)),
    [matrix],
  );

  async function toggle(groupPath: string, clusterRole: string) {
    const key = `${groupPath}::${clusterRole}`;
    setPendingCell(key);
    setSaveError(null);
    try {
      await setRbacMapping(token, tenant, groupPath, clusterRole, !mappings.has(key));
      refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save mapping");
    } finally {
      setPendingCell(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">RBAC matrix</h1>
        <p className="text-sm text-muted-foreground">
          Keycloak group to tenant ClusterRole mappings.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p>
            Group membership is managed in Keycloak only — this page manages the mapping
            from groups to tenant ClusterRoles.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load RBAC matrix: {error.message}
          </CardContent>
        </Card>
      )}

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      {!error && loading && !matrix && (
        <p className="text-sm text-muted-foreground">Loading RBAC matrix…</p>
      )}

      {!error && matrix && matrix.groups.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No Keycloak groups found for this tenant.
            </p>
          </CardContent>
        </Card>
      )}

      {!error && matrix && matrix.groups.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Group</th>
                  <th className="px-4 py-2 font-medium">Team</th>
                  <th className="px-4 py-2 font-medium">Members</th>
                  {matrix.roles.map((role) => (
                    <th key={role.name} className="px-4 py-2 text-center font-medium">
                      <span className="font-mono">{role.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.groups.map((group) => (
                  <tr key={group.path} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{group.path}</td>
                    <td className="px-4 py-2">{group.team}</td>
                    <td className="px-4 py-2">{group.memberCount}</td>
                    {matrix.roles.map((role) => {
                      const key = `${group.path}::${role.name}`;
                      const mapped = mappings.has(key);
                      const pending = pendingCell === key;
                      return (
                        <td key={role.name} className="px-4 py-2 text-center">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Map ${group.path} to ${role.name}`}
                            aria-pressed={mapped}
                            disabled={pendingCell !== null}
                            title={
                              pending
                                ? "Saving…"
                                : mapped
                                  ? `Remove mapping ${group.path} → ${role.name}`
                                  : `Map ${group.path} → ${role.name}`
                            }
                            onClick={() => void toggle(group.path, role.name)}
                          >
                            {pending ? (
                              <Loader2 className="animate-spin" aria-hidden />
                            ) : mapped ? (
                              <Check aria-hidden />
                            ) : null}
                          </Button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Card>
            <CardContent className="space-y-2 py-4">
              <p className="text-xs font-medium text-muted-foreground">ClusterRole legend</p>
              <ul className="space-y-1">
                {matrix.roles.map((role) => (
                  <li key={role.name} className="flex items-center gap-2 text-sm">
                    <Badge variant={role.kind === "operator" ? "warning" : "secondary"}>
                      {role.kind}
                    </Badge>
                    <span className="font-mono text-xs">{role.name}</span>
                    <span className="text-muted-foreground">— {role.description}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
