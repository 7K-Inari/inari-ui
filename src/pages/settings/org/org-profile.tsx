import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { listTenants, patchTenant } from "@/api/tenants";
import type { Tenant } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";
import { LoadingState } from "@/components/loading";

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
          <div className="card-body">{actionError}</div>
        </Card>
      )}

      {saved && !actionError && (
        <Card>
          <div className="card-body">Organization profile saved.</div>
        </Card>
      )}

      <Card>
        <div className="card-body">
          <form className="max-w-xl space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="org-slug">Slug</label>
              <Input id="org-slug" value={organization.slug} disabled />
              <p className="text-xs u-muted">
                Immutable tenant identifier used in URLs and API paths.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="org-display-name">Display name</label>
              <Input
                id="org-display-name"
                value={displayName}
                onChange={(v) => setDisplayName(v)}
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
        </div>
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
            <span className="text-xs u-muted">Read-only (org viewer)</span>
          ) : undefined
        }
      />

      {error && (
        <Card>
          <div className="card-body">
            Failed to load organization: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !organization && (
        <LoadingState label="Loading organization…" />
      )}

      {!error && !loading && !organization && (
        <Card>
          <div className="card-body">
            Organization not found.
          </div>
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
