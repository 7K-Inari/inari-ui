import { Badge, Card } from "7k-design-system/react";

import type { GitRepoViewModel } from "@/api/git-repos";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { Link } from "react-router-dom";

export interface GitOpsRepoCardProps {
  repo: GitRepoViewModel | null;
  commitSha: string | null;
  prUrl: string | null;
}

export function GitOpsRepoCard({ repo, commitSha, prUrl }: GitOpsRepoCardProps) {
  const { tenant } = useTenant();

  if (!repo) return null;

  const shortSha = commitSha ? commitSha.slice(0, 7) : null;
  const prNumber = prUrl ? prUrl.split("/").pop() : null;

  return (
    <Card>
      <div className="card-header">
        <h2 className="mono-label">GitOps Repository</h2>
      </div>
      <div className="card-body space-y-3">
        <div className="flex items-center gap-2">
          <Link
            to={tenantLink(tenant, "settings/org/git")}
            className="font-semibold text-brand-primary"
          >
            {repo.name}
          </Link>
          <Badge variant={repo.commitPolicy === "pull_request" ? "warning" : "neutral"}>
            {repo.commitPolicy === "pull_request" ? "Pull Request" : "Direct"}
          </Badge>
        </div>
        <p className="font-mono text-sm u-muted">{repo.repo}</p>
        <div className="flex gap-6">
          {shortSha && (
            <div>
              <p className="mono-label">COMMIT</p>
              <a
                href={`https://github.com/${repo.repo}/commit/${commitSha}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm u-info"
              >
                {shortSha}
              </a>
            </div>
          )}
          {prUrl && (
            <div>
              <p className="mono-label">PULL REQUEST</p>
              <a
                href={prUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm u-info"
              >
                #{prNumber} · merged
              </a>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
