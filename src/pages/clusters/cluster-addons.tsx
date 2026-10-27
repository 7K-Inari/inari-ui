import * as React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Skeleton } from "7k-design-system/react";
import type { BadgeVariant } from "7k-design-system/react";
import { ExternalLink } from "lucide-react";

import {
  listClusterAddons,
  partitionAddons,
  type AddonMutationResult,
  type AddonState,
  type AddonViewModel,
} from "@/api/addons";
import { getCluster } from "@/api/clusters";
import { listGitRepos, type GitRepoViewModel } from "@/api/git-repos";
import { useAsyncResource } from "@/api/hooks";
import { PageHeader } from "@/components/page-header";
import { healthToBadge } from "@/lib/status-badges";
import { AdoptAddonModal } from "@/pages/clusters/addons/adopt-addon-modal";
import { EditAddonDrawer } from "@/pages/clusters/addons/edit-addon-drawer";
import { EnablePruneModal } from "@/pages/clusters/addons/enable-prune-modal";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const STATE_BADGE: Record<AddonState, BadgeVariant> = {
  managed: "success",
  adopting: "warning",
  update_failed: "danger",
  discovered: "info",
};

function syncToBadge(sync: string): BadgeVariant {
  return sync.toLowerCase() === "synced" ? "success" : "warning";
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function ManagedTable({
  addons,
  repos,
  onEdit,
  onEnablePrune,
}: {
  addons: AddonViewModel[];
  repos: GitRepoViewModel[];
  onEdit: (addon: AddonViewModel) => void;
  onEnablePrune: (addon: AddonViewModel) => void;
}) {
  if (addons.length === 0) {
    return (
      <div className="empty">
        <span className="empty-title">No managed addons</span>
        <span className="empty-text">
          Adopt a discovered addon from the Discovered tab, or deploy one from the catalog, to
          manage it through GitOps.
        </span>
      </div>
    );
  }
  const repoName = (id: string | null) => repos.find((r) => r.id === id)?.name ?? id ?? "—";
  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">Managed addons ({addons.length})</h2>
      </div>
      <div className="card-body">
        <table className="table">
          <thead>
            <tr>
              <th>Addon</th>
              <th>Version</th>
              <th>Health</th>
              <th>Sync</th>
              <th>Repo</th>
              <th>Git</th>
              <th>Prune</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {addons.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.catalogItem}</span>
                    <Badge variant={STATE_BADGE[a.state]}>{a.state.replace("_", " ")}</Badge>
                    {a.isFleet && <Badge variant="info">ApplicationSet</Badge>}
                  </div>
                  {a.repoPath && <p className="font-mono text-xs u-muted">{a.repoPath}</p>}
                </td>
                <td className="mono">{a.chartVersion ?? "—"}</td>
                <td>
                  {a.health ? (
                    <Badge variant={healthToBadge(a.health)}>{a.health}</Badge>
                  ) : (
                    <span className="u-muted">—</span>
                  )}
                </td>
                <td>
                  {a.sync ? (
                    <Badge variant={syncToBadge(a.sync)}>{a.sync}</Badge>
                  ) : (
                    <span className="u-muted">—</span>
                  )}
                </td>
                <td className="mono">{repoName(a.repoId)}</td>
                <td>
                  {a.prUrl ? (
                    <a
                      href={a.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 u-accent"
                    >
                      Pull request <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : a.commitSha ? (
                    <span className="mono" title={a.commitSha}>
                      {shortSha(a.commitSha)}
                    </span>
                  ) : (
                    <span className="u-muted">—</span>
                  )}
                </td>
                <td>
                  {a.pruneEnabled ? (
                    <Badge variant="warning">prune on</Badge>
                  ) : (
                    <Badge variant="neutral">prune off</Badge>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onEdit(a)}>
                      Edit
                    </Button>
                    {!a.pruneEnabled && (
                      <Button variant="ghost" size="sm" onClick={() => onEnablePrune(a)}>
                        Enable prune
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DiscoveredTable({
  addons,
  onAdopt,
}: {
  addons: AddonViewModel[];
  onAdopt: (addon: AddonViewModel) => void;
}) {
  if (addons.length === 0) {
    return (
      <div className="empty">
        <span className="empty-title">Nothing discovered</span>
        <span className="empty-text">
          The agent scanner reports helm releases it finds on the cluster. Discovered addons show
          up here, ready to adopt into GitOps.
        </span>
      </div>
    );
  }
  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">Discovered addons ({addons.length})</h2>
      </div>
      <div className="card-body">
        <table className="table">
          <thead>
            <tr>
              <th>Addon</th>
              <th>Release</th>
              <th>Namespace</th>
              <th>Detected version</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {addons.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold">{a.catalogItem}</td>
                <td className="mono">{a.discovered?.releaseName ?? "—"}</td>
                <td className="mono">{a.discovered?.namespace ?? "—"}</td>
                <td className="mono">{a.discovered?.detectedVersion ?? "—"}</td>
                <td>
                  <Button variant="accent" size="sm" onClick={() => onAdopt(a)}>
                    Adopt into GitOps
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Cluster addons page (Feature C): Managed / Discovered tabs over the M3W2
// addons API, with edit drawer, adopt dialog, and explicit enable-prune.
export function ClusterAddonsPage() {
  const { tenant } = useTenant();
  const { clusterId } = useParams<{ clusterId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "discovered" ? "discovered" : "managed";

  const [editing, setEditing] = React.useState<AddonViewModel | null>(null);
  const [adopting, setAdopting] = React.useState<AddonViewModel | null>(null);
  const [pruning, setPruning] = React.useState<AddonViewModel | null>(null);
  const [notice, setNotice] = React.useState<AddonMutationResult | null>(null);

  const cluster = useAsyncResource((tok) => getCluster(tok, clusterId!), [clusterId], {
    enabled: !!clusterId,
  });
  const repos = useAsyncResource((tok) => listGitRepos(tok, tenant), [tenant]);
  const {
    data: addons,
    loading,
    error,
    refetch,
  } = useAsyncResource((tok) => listClusterAddons(tok, clusterId!, tenant), [clusterId, tenant], {
    enabled: !!clusterId,
    refetchIntervalMs: 15_000,
  });

  if (error) {
    return (
      <div className="stack">
        <Alert variant="danger">Failed to load addons: {error.message}</Alert>
        <Link to={tenantLink(tenant, `clusters/${clusterId}`)} className="btn btn-secondary">
          Back to cluster
        </Link>
      </div>
    );
  }

  if (loading && !addons) {
    return (
      <div className="overview-card-skeleton" aria-busy="true">
        <Skeleton height={32} width="40%" />
        <Skeleton height={240} />
      </div>
    );
  }

  const { managed, discovered } = partitionAddons(addons ?? []);

  const onMutated = (result: AddonMutationResult) => {
    setEditing(null);
    setAdopting(null);
    setPruning(null);
    setNotice(result);
    refetch();
  };

  return (
    <div className="stack">
      <PageHeader
        breadcrumb="Operate / Clusters"
        title={`Addons — ${cluster.data?.name ?? clusterId}`}
        actions={
          <Link
            to={tenantLink(tenant, `clusters/${clusterId}`)}
            className="btn btn-secondary btn-sm"
          >
            Back to cluster
          </Link>
        }
      />

      {notice?.prUrl && (
        <Alert variant="success">
          Change committed via pull request:{" "}
          <a href={notice.prUrl} target="_blank" rel="noreferrer" className="u-accent">
            {notice.prUrl}
          </a>{" "}
          — merge it in GitHub for ArgoCD to sync.
        </Alert>
      )}
      {notice && !notice.prUrl && notice.commitSha && (
        <Alert variant="success">
          Change committed ({shortSha(notice.commitSha)}); ArgoCD will sync it shortly.
        </Alert>
      )}

      <div className="tabs" role="tablist" aria-label="Addon sections">
        {(
          [
            { id: "managed", label: `Managed (${managed.length})` },
            { id: "discovered", label: `Discovered (${discovered.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab tab-accent${tab === t.id ? " active" : ""}`}
            onClick={() => {
              setNotice(null); // a stale success alert shouldn't linger across tabs
              setSearchParams({ tab: t.id }, { replace: true });
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "managed" ? (
        <ManagedTable
          addons={managed}
          repos={repos.data ?? []}
          onEdit={setEditing}
          onEnablePrune={setPruning}
        />
      ) : (
        <DiscoveredTable addons={discovered} onAdopt={setAdopting} />
      )}

      <EditAddonDrawer addon={editing} onClose={() => setEditing(null)} onSaved={onMutated} />
      <AdoptAddonModal addon={adopting} onClose={() => setAdopting(null)} onAdopted={onMutated} />
      <EnablePruneModal addon={pruning} onClose={() => setPruning(null)} onEnabled={onMutated} />
    </div>
  );
}
