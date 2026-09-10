import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { listTenants, patchTenant } from "@/api/tenants";
import type { Tenant } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

function OrgProfileForm({
  tenant,
  organization,
  canWrite,
}: {
  tenant: string;
  organization: Tenant;
  canWrite: boolean;
}) {
  const { token } = useAuth();
  const [displayName, setDisplayName] = React.useState(organization.displayName);
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSaved(false);
    setSaving(true);
    try {
      await patchTenant(token, tenant, { displayName });
      setSaved(true);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save organization profile",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {saved && !actionError && (
        <Card>
          <CardContent className="py-3 text-sm">Organization profile saved.</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-4">
          <form className="max-w-xl space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="org-slug">Slug</Label>
              <Input id="org-slug" value={organization.slug} disabled />
              <p className="text-xs text-muted-foreground">
                Immutable tenant identifier used in URLs and API paths.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-display-name">Display name</Label>
              <Input
                id="org-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={!canWrite}
              />
            </div>
            {canWrite && (
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </>
  );
}

export function OrgProfilePage() {
  const { tenant } = useTenant();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: tenants,
    loading,
    error,
  } = useAsyncResource((t) => listTenants(t), [tenant]);

  const organization = tenants?.find((o) => o.slug === tenant) ?? null;

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Organization profile"
        description="Display name and identity of this organization."
        actions={
          !canWriteSettings ? (
            <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
          ) : undefined
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load organization: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !organization && (
        <p className="text-sm text-muted-foreground">Loading organization…</p>
      )}

      {!error && !loading && !organization && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Organization not found.
          </CardContent>
        </Card>
      )}

      {!error && organization && !loading && (
        <OrgProfileForm
          key={tenant}
          tenant={tenant}
          organization={organization}
          canWrite={canWriteSettings}
        />
      )}
    </div>
  );
}
