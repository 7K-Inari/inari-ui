import * as React from "react";
import { Link } from "react-router-dom";

import { useAsyncResource } from "@/api/hooks";
import { listGitRepos, type GitRepoViewModel } from "@/api/git-repos";
import { listTeams } from "@/api/tenants";
import { Alert, Button, Card, Skeleton } from "7k-design-system/react";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

import { DeleteRepoModal } from "./git/delete-repo-modal";
import { OrgDefaultsCard } from "./git/org-defaults-card";
import { RegisterRepoModal } from "./git/register-repo-modal";
import { RepoDrawer } from "./git/repo-drawer";
import { RepoTable } from "./git/repo-table";

export function GitSettingsPage() {
  const { tenant } = useTenant();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: repos,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listGitRepos(t, tenant), [tenant]);
  const { data: teams } = useAsyncResource((t) => listTeams(t, tenant), [tenant]);

  const [drawerRepo, setDrawerRepo] = React.useState<GitRepoViewModel | null>(null);
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [deleteRepo, setDeleteRepo] = React.useState<GitRepoViewModel | null>(null);

  const teamList = (teams ?? []).map((t) => ({ id: t.id, displayName: t.displayName }));

  const handleSaved = () => {
    setDrawerRepo(null);
    refetch();
  };

  const handleDeleted = () => {
    setDeleteRepo(null);
    setDrawerRepo(null);
    refetch();
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Git"
        description="GitOps state repositories and commit policies for this organization."
        actions={
          <div className="flex items-center gap-2">
            {!canWriteSettings && (
              <span className="text-xs u-muted">Read-only (org viewer)</span>
            )}
            <Link
              to={tenantLink(tenant, "settings/org/git/new")}
              className="btn btn-glow-accent"
            >
              New GitOps Repo
            </Link>
          </div>
        }
      />

      {error && (
        <Alert variant="danger">
          <span>Failed to load repositories: {error.message}</span>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </Alert>
      )}

      {!error && loading && !repos && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={48} />
          ))}
        </div>
      )}

      {!error && repos && repos.length === 0 && (
        <Card>
          <div className="card-body empty">
            <span className="empty-title">No repositories registered</span>
            <span className="empty-text">
              Register an existing GitOps repo or create a new one from a template.
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setRegisterOpen(true)}>
                Register Existing
              </Button>
              <Link
                to={tenantLink(tenant, "settings/org/git/new")}
                className="btn btn-accent"
              >
                New GitOps Repo
              </Link>
            </div>
          </div>
        </Card>
      )}

      {!error && repos && repos.length > 0 && (
        <>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setRegisterOpen(true)}>
              + Register Existing
            </Button>
          </div>
          <RepoTable
            repos={repos}
            teams={teamList}
            onSelect={setDrawerRepo}
          />
        </>
      )}

      <OrgDefaultsCard canWrite={canWriteSettings} />

      <RegisterRepoModal
        open={registerOpen}
        teams={teamList}
        onClose={() => setRegisterOpen(false)}
        onRegistered={() => refetch()}
      />

      <RepoDrawer
        repo={drawerRepo}
        teams={teamList}
        canWrite={canWriteSettings}
        onClose={() => setDrawerRepo(null)}
        onSaved={handleSaved}
        onDelete={(r) => setDeleteRepo(r)}
      />

      <DeleteRepoModal
        repo={deleteRepo}
        onClose={() => setDeleteRepo(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
