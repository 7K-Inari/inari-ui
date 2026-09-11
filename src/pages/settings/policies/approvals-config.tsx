import * as React from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  getApprovalConfig,
  putApprovalConfig,
  type ApprovalThreshold,
  type AutoApproveRule,
} from "@/api/policies";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/time";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

export function ApprovalsConfigPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const { data: config, loading, error, refetch } = useAsyncResource(
    (t) => getApprovalConfig(t, tenant),
    [tenant],
  );

  const [thresholds, setThresholds] = React.useState<ApprovalThreshold[] | null>(null);
  const [groups, setGroups] = React.useState<string[] | null>(null);
  const [rules, setRules] = React.useState<AutoApproveRule[] | null>(null);
  const [newGroup, setNewGroup] = React.useState("");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const effectiveThresholds = thresholds ?? config?.thresholds ?? [];
  const effectiveGroups = groups ?? config?.approverGroups ?? [];
  const effectiveRules = rules ?? config?.autoApproveRules ?? [];
  const dirty = thresholds !== null || groups !== null || rules !== null;

  const setThreshold = (idx: number, value: number) =>
    setThresholds(
      effectiveThresholds.map((t, i) =>
        i === idx ? { ...t, approvalsRequired: value } : t,
      ),
    );

  const removeGroup = (group: string) =>
    setGroups(effectiveGroups.filter((g) => g !== group));

  const addGroup = () => {
    const value = newGroup.trim();
    if (!value || effectiveGroups.includes(value)) return;
    setGroups([...effectiveGroups, value]);
    setNewGroup("");
  };

  const removeRule = (idx: number) =>
    setRules(effectiveRules.filter((_, i) => i !== idx));

  const save = async () => {
    setActionError(null);
    setSaved(false);
    try {
      await putApprovalConfig(token, tenant, {
        thresholds: effectiveThresholds,
        approverGroups: effectiveGroups,
        autoApproveRules: effectiveRules,
      });
      setThresholds(null);
      setGroups(null);
      setRules(null);
      setSaved(true);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save approval config");
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Approvals configuration"
        description="Approval thresholds, approver groups, and auto-approve rules for this organization."
        actions={
          <CapabilityGate
            capability="admin"
            fallback={
              <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
            }
          >
            <Button onClick={save} disabled={!dirty}>
              Save configuration
            </Button>
          </CapabilityGate>
        }
      />

      <p className="text-xs text-muted-foreground">
        Pending requests are decided on the{" "}
        <Link
          to={tenantLink(tenant, "approvals")}
          className="underline underline-offset-2 hover:text-foreground"
        >
          approvals inbox
        </Link>
        .
      </p>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load approval config: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !config && (
        <p className="text-sm text-muted-foreground">Loading approval config…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {saved && !dirty && (
        <Card>
          <CardContent className="py-3 text-sm">Configuration saved.</CardContent>
        </Card>
      )}

      {config && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 py-4">
              <h2 className="text-sm font-medium">Thresholds</h2>
              <div className="space-y-2">
                {effectiveThresholds.map((t, idx) => (
                  <div key={t.action} className="flex items-center gap-3">
                    <span className="w-40 font-mono text-xs">{t.action}</span>
                    <Input
                      type="number"
                      min={0}
                      aria-label={`Approvals required for ${t.action}`}
                      className="w-28"
                      value={String(t.approvalsRequired)}
                      disabled={!canWriteSettings}
                      onChange={(e) => setThreshold(idx, Number(e.target.value))}
                    />
                    <span className="text-xs text-muted-foreground">approvals required</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 py-4">
              <h2 className="text-sm font-medium">Approver groups</h2>
              <ul className="space-y-1">
                {effectiveGroups.map((group) => (
                  <li key={group} className="flex items-center gap-3">
                    <span className="font-mono text-xs">{group}</span>
                    {canWriteSettings && (
                      <Button variant="ghost" size="sm" onClick={() => removeGroup(group)}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {canWriteSettings && (
                <div className="flex items-end gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-group">Add group</Label>
                    <Input
                      id="new-group"
                      value={newGroup}
                      onChange={(e) => setNewGroup(e.target.value)}
                      placeholder="tenant-acme/team"
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={addGroup}>
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 py-4">
              <h2 className="text-sm font-medium">Auto-approve rules</h2>
              {effectiveRules.length === 0 && (
                <p className="text-sm text-muted-foreground">No auto-approve rules.</p>
              )}
              <ul className="space-y-1">
                {effectiveRules.map((rule, idx) => (
                  <li key={`${rule.action}-${idx}`} className="flex items-center gap-3">
                    <span className="font-mono text-xs">{rule.action}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {rule.condition}
                    </span>
                    {canWriteSettings && (
                      <Button variant="ghost" size="sm" onClick={() => removeRule(idx)}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Last updated by {config.updatedBy || "unknown"} {formatRelative(config.updatedAt)}
          </p>
        </div>
      )}
    </div>
  );
}
