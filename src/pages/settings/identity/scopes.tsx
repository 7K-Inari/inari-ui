import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  listOidcClients,
  listOidcScopes,
  putClientScopes,
  type OidcClient,
} from "@/api/identity";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CapabilityGate } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

export function OidcScopesPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const {
    data: scopes,
    loading,
    error,
  } = useAsyncResource((t) => listOidcScopes(t, tenant), [tenant]);
  const { data: clients, refetch: refetchClients } = useAsyncResource(
    (t) => listOidcClients(t, tenant),
    [tenant],
  );

  const [assigning, setAssigning] = React.useState<OidcClient | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [actionError, setActionError] = React.useState<string | null>(null);

  const fail = (err: unknown, fallback: string) =>
    setActionError(err instanceof ApiError ? err.message : fallback);

  const openAssign = (client: OidcClient) => {
    setSelected(new Set(client.scopes));
    setAssigning(client);
    setActionError(null);
  };

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const save = async () => {
    if (!assigning) return;
    setActionError(null);
    try {
      await putClientScopes(token, tenant, assigning.id, [...selected]);
      setAssigning(null);
      refetchClients();
    } catch (err) {
      fail(err, "Failed to assign scopes");
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Scopes"
        description="Audience/scope catalog and per-client scope assignment."
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load scopes: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !scopes && (
        <p className="text-sm text-muted-foreground">Loading scopes…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {scopes && scopes.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Audience</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {scopes.map((scope) => (
                <tr key={scope.name} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{scope.name}</td>
                  <td className="px-4 py-2">
                    {scope.audience ? (
                      <Badge variant="muted">{scope.audience}</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">{scope.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {clients && clients.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Client assignments</h2>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Scopes</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <React.Fragment key={client.id}>
                    <tr className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{client.name}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {client.scopes.join(", ") || "—"}
                      </td>
                      <td className="px-4 py-2">
                        <CapabilityGate capability="admin">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              assigning?.id === client.id
                                ? setAssigning(null)
                                : openAssign(client)
                            }
                          >
                            Assign scopes
                          </Button>
                        </CapabilityGate>
                      </td>
                    </tr>
                    {assigning?.id === client.id && (
                      <tr className="border-t bg-muted/20">
                        <td colSpan={3} className="px-4 py-3">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="space-y-1.5">
                              {(scopes ?? []).map((scope) => (
                                <label
                                  key={scope.name}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-input accent-primary"
                                    checked={selected.has(scope.name)}
                                    onChange={() => toggle(scope.name)}
                                  />
                                  <span className="font-mono text-xs">{scope.name}</span>
                                </label>
                              ))}
                            </div>
                            <Button size="sm" onClick={save}>
                              Save scopes
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
