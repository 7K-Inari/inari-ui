import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { getGitConfig, putGitConfig } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

interface GitConfig {
  repo: string;
  baseBranch: string;
  commitPolicy: string;
}

// Remounted per tenant (key={tenant} at the call site) so form state can be
// initialized from props and never leaks stale values across a tenant switch.
function GitConfigForm({
  tenant,
  config,
  canWrite,
}: {
  tenant: string;
  config: GitConfig;
  canWrite: boolean;
}) {
  const { token } = useAuth();
  const [repo, setRepo] = React.useState(config.repo);
  const [baseBranch, setBaseBranch] = React.useState(config.baseBranch);
  const [commitPolicy, setCommitPolicy] = React.useState<"direct" | "pull_request">(
    config.commitPolicy === "direct" ? "direct" : "pull_request",
  );
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSaved(false);
    setSaving(true);
    try {
      await putGitConfig(token, tenant, {
        repo,
        baseBranch: baseBranch || undefined,
        commitPolicy,
      });
      setSaved(true);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save git config",
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
          <CardContent className="py-3 text-sm">Git config saved.</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-4">
          <form className="max-w-xl space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="git-repo">Repository</Label>
              <Input
                id="git-repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/name or https URL"
                required
                disabled={!canWrite}
              />
              <p className="text-xs text-muted-foreground">
                owner/name or https URL of the {"<tenant>"}-inari-state repo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="git-branch">Base branch</Label>
              <Input
                id="git-branch"
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                placeholder="main"
                disabled={!canWrite}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="git-policy">Commit policy</Label>
              <select
                id="git-policy"
                className={selectClass}
                value={commitPolicy}
                onChange={(e) =>
                  setCommitPolicy(e.target.value as "direct" | "pull_request")
                }
                disabled={!canWrite}
              >
                <option value="pull_request">pull_request</option>
                <option value="direct">direct</option>
              </select>
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

export function GitSettingsPage() {
  const { tenant } = useTenant();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: config,
    loading,
    error,
  } = useAsyncResource((t) => getGitConfig(t, tenant), [tenant]);

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Git"
        description="GitOps state repository and commit policy for this organization."
        actions={
          !canWriteSettings ? (
            <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
          ) : undefined
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load git config: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !config && (
        <p className="text-sm text-muted-foreground">Loading git config…</p>
      )}

      {!error && config && !loading && (
        <GitConfigForm key={tenant} tenant={tenant} config={config} canWrite={canWriteSettings} />
      )}
    </div>
  );
}
