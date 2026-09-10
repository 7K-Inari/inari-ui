import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  listCatalogVisibility,
  putCatalogVisibility,
} from "@/api/policies";
import type { CatalogVisibilityRule } from "@/api/policies";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

function RuleRow({
  tenant,
  rule,
  canWrite,
  onChanged,
}: {
  tenant: string;
  rule: CatalogVisibilityRule;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const toggle = async () => {
    setActionError(null);
    setBusy(true);
    try {
      await putCatalogVisibility(token, tenant, rule.itemId, !rule.visible);
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to update visibility",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-2 font-medium">{rule.itemName}</td>
      <td className="px-4 py-2 font-mono text-xs">{rule.itemId}</td>
      <td className="px-4 py-2">
        {rule.visible ? (
          <Badge variant="success">visible</Badge>
        ) : (
          <Badge variant="muted">hidden</Badge>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {rule.updatedBy} · {formatRelative(rule.updatedAt)}
      </td>
      <td className="px-4 py-2 text-right">
        {actionError && (
          <span className="mr-2 text-xs text-destructive">{actionError}</span>
        )}
        {canWrite && (
          <Button variant="outline" size="sm" disabled={busy} onClick={toggle}>
            {rule.visible ? "Hide" : "Show"}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function VisibilityPage() {
  const { tenant } = useTenant();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: rules,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listCatalogVisibility(t, tenant), [tenant]);

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Catalog visibility"
        description="Tenant-scoped overrides for catalog items. Hidden items are not deployable by this organization."
        actions={
          !canWriteSettings ? (
            <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
          ) : undefined
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load visibility rules: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !rules && (
        <p className="text-sm text-muted-foreground">Loading visibility rules…</p>
      )}

      {!error && rules && rules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No visibility overrides — the catalog follows platform defaults.
          </CardContent>
        </Card>
      )}

      {rules && rules.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2 font-medium">Updated</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <RuleRow
                  key={r.itemId}
                  tenant={tenant}
                  rule={r}
                  canWrite={canWriteSettings}
                  onChanged={refetch}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
