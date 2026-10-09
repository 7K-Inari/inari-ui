import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { getGitConfig, putGitConfig } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

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
          <div className="card-body">{actionError}</div>
        </Card>
      )}

      {saved && !actionError && (
        <Card>
          <div className="card-body">Git config saved.</div>
        </Card>
      )}

      <Card>
        <div className="card-body">
          <form className="max-w-xl space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="git-repo">Repository</label>
              <Input
                id="git-repo"
                value={repo}
                onChange={(v) => setRepo(v)}
                placeholder="owner/name or https URL"
                required
                disabled={!canWrite}
              />
              <p className="text-xs u-muted">
                owner/name or https URL of the {"<tenant>"}-inari-state repo.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="git-branch">Base branch</label>
              <Input
                id="git-branch"
                value={baseBranch}
                onChange={(v) => setBaseBranch(v)}
                placeholder="main"
                disabled={!canWrite}
              />
            </div>
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="git-policy">Commit policy</label>
              <select
                id="git-policy"
                className="select-native"
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
        </div>
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
            <span className="text-xs u-muted">Read-only (org viewer)</span>
          ) : undefined
        }
      />

      {error && (
        <Card>
          <div className="card-body">
            Failed to load git config: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !config && (
        <p className="text-sm u-muted">Loading git config…</p>
      )}

      {!error && config && !loading && (
        <GitConfigForm key={tenant} tenant={tenant} config={config} canWrite={canWriteSettings} />
      )}
    </div>
  );
}
