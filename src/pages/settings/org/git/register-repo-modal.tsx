import * as React from "react";
import { Button, Input, Modal, Radio, Select } from "7k-design-system/react";

import { ApiError } from "@/api/client";
import { registerGitRepo, type GitRepoViewModel } from "@/api/git-repos";
import { useAuth } from "@/auth/auth-context";
import { useTenant } from "@/tenant/tenant-context";

export interface RegisterRepoModalProps {
  open: boolean;
  teams: { id: string; displayName: string }[];
  onClose: () => void;
  onRegistered: (repo: GitRepoViewModel) => void;
}

export function RegisterRepoModal({
  open,
  teams,
  onClose,
  onRegistered,
}: RegisterRepoModalProps) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [name, setName] = React.useState("");
  const [repo, setRepo] = React.useState("");
  const [baseBranch, setBaseBranch] = React.useState("main");
  const [scope, setScope] = React.useState<"platform" | "team">("team");
  const [teamId, setTeamId] = React.useState("");
  const [commitPolicy, setCommitPolicy] = React.useState<"direct" | "pull_request">("pull_request");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setRepo("");
      setBaseBranch("main");
      setScope("team");
      setTeamId("");
      setCommitPolicy("pull_request");
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await registerGitRepo(token, tenant, {
        name,
        repo,
        scope,
        teamId: scope === "team" ? teamId : undefined,
        commitPolicy,
        baseBranch,
      });
      onRegistered(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to register repo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} aria-label="Register existing repository">
      <div className="modal-header">
        <h2 className="text-xl font-semibold">Register Existing Repository</h2>
        <p className="text-sm u-muted">
          Connect an existing Git repository to this organization.
        </p>
      </div>
      <div className="modal-body">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="reg-name">Display name</label>
            <Input
              id="reg-name"
              value={name}
              onChange={(v) => setName(v)}
              placeholder="my-team-gitops"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="reg-repo">Repository (owner/name)</label>
            <Input
              id="reg-repo"
              value={repo}
              onChange={(v) => setRepo(v)}
              placeholder="myorg/my-repo"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="reg-branch">Base branch</label>
            <Input
              id="reg-branch"
              value={baseBranch}
              onChange={(v) => setBaseBranch(v)}
              placeholder="main"
            />
          </div>
          <div className="space-y-1.5">
            <span className="form-label">Scope</span>
            <div className="flex gap-4">
              <Radio
                id="scope-platform"
                name="scope"
                label="Platform"
                checked={scope === "platform"}
                onChange={() => setScope("platform")}
              />
              <Radio
                id="scope-team"
                name="scope"
                label="Team"
                checked={scope === "team"}
                onChange={() => setScope("team")}
              />
            </div>
          </div>
          {scope === "team" && (
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="reg-team">Owning team</label>
              <Select
                id="reg-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Select a team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.displayName}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="form-label" htmlFor="reg-policy">Commit policy</label>
            <Select
              id="reg-policy"
              value={commitPolicy}
              onChange={(e) => setCommitPolicy(e.target.value as "direct" | "pull_request")}
            >
              <option value="pull_request">pull_request</option>
              <option value="direct">direct</option>
            </Select>
          </div>
          {error && <p className="text-sm u-danger">{error}</p>}
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? "Registering…" : "Register Repo"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
