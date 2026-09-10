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

export function GitSettingsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: config,
    loading,
    error,
  } = useAsyncResource((t) => getGitConfig(t, tenant), [tenant]);

  const [repo, setRepo] = React.useState("");
  const [baseBranch, setBaseBranch] = React.useState("");
  const [commitPolicy, setCommitPolicy] = React.useState<"direct" | "pull_request">(
    "pull_request",
  );
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!config) return;
    setRepo(config.repo);
    setBaseBranch(config.baseBranch);
    setCommitPolicy(config.commitPolicy === "direct" ? "direct" : "pull_request");
  }, [config]);

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

      {!error && config && (
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
                  disabled={!canWriteSettings}
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
                  disabled={!canWriteSettings}
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
                  disabled={!canWriteSettings}
                >
                  <option value="pull_request">pull_request</option>
                  <option value="direct">direct</option>
                </select>
              </div>
              {canWriteSettings && (
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
