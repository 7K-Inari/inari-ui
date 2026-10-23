import * as React from "react";
import { Button, Card, Input } from "7k-design-system/react";

import { ApiError } from "@/api/client";
import { getGitConfig, putGitConfig } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { useTenant } from "@/tenant/tenant-context";

export interface OrgDefaultsCardProps {
  canWrite: boolean;
}

export function OrgDefaultsCard({ canWrite }: OrgDefaultsCardProps) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [commitPolicy, setCommitPolicy] = React.useState<"direct" | "pull_request">("direct");
  const [scaffoldGitOrg, setScaffoldGitOrg] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getGitConfig(token, tenant)
      .then((config) => {
        if (cancelled) return;
        setCommitPolicy(config.commitPolicy === "direct" ? "direct" : "pull_request");
        setScaffoldGitOrg(config.repo ?? "");
      })
      .catch(() => {
        // Org defaults are optional; ignore load errors
      });
    return () => { cancelled = true; };
  }, [token, tenant]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await putGitConfig(token, tenant, {
        repo: scaffoldGitOrg,
        commitPolicy,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save defaults");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">ORG DEFAULTS</h2>
      </div>
      <div className="card-body">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="org-policy">Commit policy default</label>
            <select
              id="org-policy"
              className="select-native"
              value={commitPolicy}
              onChange={(e) => setCommitPolicy(e.target.value as "direct" | "pull_request")}
              disabled={!canWrite}
            >
              <option value="direct">direct</option>
              <option value="pull_request">pull_request</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="org-scaffold">Scaffold git org</label>
            <Input
              id="org-scaffold"
              value={scaffoldGitOrg}
              onChange={(v) => setScaffoldGitOrg(v)}
              placeholder="7K-Group"
              disabled={!canWrite}
            />
          </div>
          {error && <p className="text-sm u-danger">{error}</p>}
          {saved && <p className="text-sm u-success">Defaults saved.</p>}
          {canWrite && (
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Defaults"}
            </Button>
          )}
        </form>
      </div>
    </Card>
  );
}
