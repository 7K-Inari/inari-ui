import { Badge, DataTable, type DataTableColumn } from "7k-design-system/react";

import type { GitRepoViewModel } from "@/api/git-repos";

export interface RepoTableProps {
  repos: GitRepoViewModel[];
  teams: { id: string; displayName: string }[];
  onSelect: (repo: GitRepoViewModel) => void;
}

function teamName(
  teams: { id: string; displayName: string }[],
  id: string | null,
): string {
  if (!id) return "—";
  return teams.find((t) => t.id === id)?.displayName ?? id;
}

export function RepoTable({ repos, teams, onSelect }: RepoTableProps) {
  const columns: DataTableColumn<GitRepoViewModel>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <button
          type="button"
          className="table-link"
          onClick={() => onSelect(r)}
        >
          {r.name}
        </button>
      ),
    },
    { key: "repo", label: "Repository", mono: true },
    {
      key: "scope",
      label: "Scope",
      render: (r) =>
        r.scope === "platform" ? (
          <Badge variant="accent">Platform</Badge>
        ) : (
          <Badge variant="neutral">Team</Badge>
        ),
    },
    {
      key: "team",
      label: "Team",
      render: (r) => teamName(teams, r.teamId),
    },
    {
      key: "commitPolicy",
      label: "Policy",
      render: (r) =>
        r.commitPolicy === "pull_request" ? (
          <Badge variant="warning">PR</Badge>
        ) : (
          <Badge variant="neutral">Direct</Badge>
        ),
    },
    {
      key: "isDefault",
      label: "Default",
      render: (r) =>
        r.isDefault ? <Badge variant="success">Default</Badge> : null,
    },
    { key: "provider", label: "Provider" },
  ];

  return (
    <DataTable<GitRepoViewModel>
      columns={columns}
      rows={repos}
      rowKey="id"
    />
  );
}
