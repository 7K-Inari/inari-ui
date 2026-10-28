import * as React from "react";
import { Button, Drawer, Input, Select, Toggle } from "7k-design-system/react";

import { ApiError } from "@/api/client";
import { updateGitRepo, type GitRepoViewModel } from "@/api/git-repos";
import { useAuth } from "@/auth/auth-context";
import { useTenant } from "@/tenant/tenant-context";

export interface RepoDrawerProps {
  repo: GitRepoViewModel | null;
  teams: { id: string; displayName: string }[];
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (repo: GitRepoViewModel) => void;
}

export function RepoDrawer({
  repo,
  teams,
  canWrite,
  onClose,
  onSaved,
  onDelete,
}: RepoDrawerProps) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [name, setName] = React.useState("");
  const [commitPolicy, setCommitPolicy] = React.useState<"direct" | "pull_request">("direct");
  const [baseBranch, setBaseBranch] = React.useState("");
  const [teamId, setTeamId] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (repo) {
      setName(repo.name);
      setCommitPolicy(repo.commitPolicy);
      setBaseBranch(repo.baseBranch);
      setTeamId(repo.teamId ?? "");
      setIsDefault(repo.isDefault);
      setError(null);
    }
  }, [repo]);

  if (!repo) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateGitRepo(token, tenant, repo.id, {
        name,
        commitPolicy,
        baseBranch,
        teamId: teamId || undefined,
        isDefault: isDefault || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save repo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={repo !== null} onClose={onClose} side="right" aria-label="Repository settings">
      <div className="drawer-header">
        <p className="mono-label">REPOSITORY SETTINGS</p>
        <h2 className="text-xl font-semibold">{repo.name}</h2>
        <p className="font-mono text-sm u-muted">{repo.repo}</p>
      </div>
      <div className="drawer-body">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="repo-name">Display name</label>
            <Input
              id="repo-name"
              value={name}
              onChange={(v) => setName(v)}
              disabled={!canWrite}
            />
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="repo-path">Repository</label>
            <Input
              id="repo-path"
              value={repo.repo}
              disabled
              readOnly
            />
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="repo-policy">Commit policy</label>
            <Select
              id="repo-policy"
              value={commitPolicy}
              onChange={(e) => setCommitPolicy(e.target.value as "direct" | "pull_request")}
              disabled={!canWrite}
            >
              <option value="direct">direct</option>
              <option value="pull_request">pull_request</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="repo-branch">Base branch</label>
            <Input
              id="repo-branch"
              value={baseBranch}
              onChange={(v) => setBaseBranch(v)}
              disabled={!canWrite}
            />
          </div>
          {repo.scope === "team" && (
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="repo-team">Owning team</label>
              <Select
                id="repo-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                disabled={!canWrite}
              >
                <option value="">Select a team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.displayName}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Toggle
              id="repo-default"
              label="Set as default"
              checked={isDefault}
              onChange={(checked) => setIsDefault(checked)}
              disabled={!canWrite}
            />
            <p className="text-xs u-muted">
              New clusters and deploys fall back to this repo.
            </p>
          </div>
          {error && <p className="text-sm u-danger">{error}</p>}
          {canWrite && (
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </form>
        <div className="mt-8 border-t u-border-subtle pt-6">
          <p className="mono-label u-danger">DANGER ZONE</p>
          <p className="text-sm u-muted">
            Unregister this repo from Inari. Running workloads may be affected.
          </p>
          <Button
            variant="danger"
            onClick={() => onDelete(repo)}
            disabled={!canWrite}
          >
            Delete Repo
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
