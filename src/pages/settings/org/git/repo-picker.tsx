import { Badge, Card, Radio } from "7k-design-system/react";

import type { GitRepoViewModel } from "@/api/git-repos";

export interface RepoPickerProps {
  repos: GitRepoViewModel[];
  teams: { id: string; displayName: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function teamName(
  teams: { id: string; displayName: string }[],
  id: string | null,
): string {
  if (!id) return "";
  return teams.find((t) => t.id === id)?.displayName ?? id;
}

export function RepoPicker({ repos, teams, selectedId, onSelect }: RepoPickerProps) {
  return (
    <div className="space-y-3">
      <p className="mono-label">GITOPS REPOSITORY</p>
      <p className="text-sm u-muted">
        Only repos visible to your team are shown. Default is preselected.
      </p>
      <div className="space-y-2">
        {repos.map((r) => {
          const selected = r.id === selectedId;
          return (
            <Card
              key={r.id}
              className={`repo-option ${selected ? "repo-option-selected" : ""}`}
            >
              <div className="card-body flex items-start gap-3">
                <Radio
                  id={`repo-${r.id}`}
                  name="gitops-repo"
                  label={r.name}
                  checked={selected}
                  onChange={() => onSelect(r.id)}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <Badge variant={r.scope === "platform" ? "accent" : "neutral"}>
                      {r.scope}
                    </Badge>
                    <Badge variant={r.commitPolicy === "pull_request" ? "warning" : "neutral"}>
                      {r.commitPolicy === "pull_request" ? "PR" : "Direct"}
                    </Badge>
                    {r.isDefault && <Badge variant="success">Default</Badge>}
                  </div>
                  <p className="font-mono text-sm u-muted">{r.repo}</p>
                  {r.scope === "team" && r.teamId && (
                    <p className="text-xs u-muted">
                      owned by {teamName(teams, r.teamId)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
