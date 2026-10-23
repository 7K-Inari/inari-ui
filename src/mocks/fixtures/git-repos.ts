// M1.W2: GitOps repo registry fixtures (Feature A). Mirrors the M1W1 server
// contract (inari-server internal/types.TenantGitRepo). Wire shapes are
// hand-written here because the pinned OpenAPI snapshot does not yet include
// the git-repos paths — see src/api/git-repos.ts (TODO contract-sync).

import type {
  GitRepoCommitPolicy,
  GitRepoProvider,
  GitRepoScope,
} from "@/api/git-repos";

export interface MockGitRepo {
  id: string;
  orgId: string;
  name: string;
  repo: string;
  provider: GitRepoProvider;
  scope: GitRepoScope;
  teamId?: string;
  commitPolicy: GitRepoCommitPolicy;
  baseBranch: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MockGitRepoRefCounts {
  instances: number;
  addons: number;
  clusters: number;
}

export interface GitReposMockState {
  repos: Record<string, MockGitRepo[]>;
  // Reference counts per repo id — drives the 409 delete-blocked path.
  refCounts: Record<string, MockGitRepoRefCounts>;
}

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

function seedState(): GitReposMockState {
  const baseline: MockGitRepo = {
    id: "repo-baseline",
    orgId: "acme",
    name: "baseline",
    repo: "acme/acme-inari-state",
    provider: "github",
    scope: "platform",
    commitPolicy: "direct",
    baseBranch: "main",
    isDefault: true,
    createdAt: iso(now - 90 * 86_400_000),
    updatedAt: iso(now - 90 * 86_400_000),
  };
  const teamAlpha: MockGitRepo = {
    id: "repo-team-alpha",
    orgId: "acme",
    name: "team-alpha-gitops",
    repo: "acme/team-alpha-gitops",
    provider: "github",
    scope: "team",
    teamId: "team-platform",
    commitPolicy: "pull_request",
    baseBranch: "main",
    isDefault: false,
    createdAt: iso(now - 30 * 86_400_000),
    updatedAt: iso(now - 30 * 86_400_000),
  };
  const teamBeta: MockGitRepo = {
    id: "repo-team-beta",
    orgId: "acme",
    name: "team-beta-gitops",
    repo: "acme/team-beta-gitops",
    provider: "github",
    scope: "team",
    teamId: "team-platform",
    commitPolicy: "direct",
    baseBranch: "main",
    isDefault: false,
    createdAt: iso(now - 20 * 86_400_000),
    updatedAt: iso(now - 20 * 86_400_000),
  };
  return {
    repos: {
      acme: [baseline, teamAlpha, teamBeta],
      globex: [],
    },
    refCounts: {
      // team-alpha has live workloads — drives the delete-blocked path.
      "repo-team-alpha": { instances: 3, addons: 2, clusters: 0 },
    },
  };
}

let state: GitReposMockState = seedState();
let idCounter = 100;
const nextId = () => `repo-gen${++idCounter}`;

export const gitReposMockControl = {
  reset() {
    state = seedState();
  },
  getState(): GitReposMockState {
    return state;
  },
};

export function gitReposFor(org: string): MockGitRepo[] {
  return state.repos[org] ?? [];
}

export function findGitRepo(org: string, id: string): MockGitRepo | null {
  return gitReposFor(org).find((r) => r.id === id) ?? null;
}

export function gitRepoRefCounts(id: string): MockGitRepoRefCounts {
  return state.refCounts[id] ?? { instances: 0, addons: 0, clusters: 0 };
}

export interface RegisterGitRepoBody {
  name: string;
  repo: string;
  provider?: GitRepoProvider;
  scope?: GitRepoScope;
  teamId?: string;
  commitPolicy?: GitRepoCommitPolicy;
  baseBranch?: string;
  isDefault?: boolean;
}

export function registerGitRepoMock(
  org: string,
  body: RegisterGitRepoBody,
): MockGitRepo {
  const nowIso = new Date().toISOString();
  const row: MockGitRepo = {
    id: nextId(),
    orgId: org,
    name: body.name,
    repo: body.repo,
    provider: body.provider ?? "github",
    scope: body.scope ?? "team",
    teamId: body.teamId,
    commitPolicy: body.commitPolicy ?? "direct",
    baseBranch: body.baseBranch ?? "main",
    isDefault: body.isDefault ?? false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const list = (state.repos[org] ??= []);
  if (row.isDefault) {
    for (const r of list) r.isDefault = false;
  }
  list.push(row);
  return row;
}

export interface UpdateGitRepoBody {
  name?: string;
  commitPolicy?: GitRepoCommitPolicy;
  baseBranch?: string;
  teamId?: string;
  isDefault?: boolean;
}

export function updateGitRepoMock(
  org: string,
  id: string,
  body: UpdateGitRepoBody,
): MockGitRepo | null {
  const row = findGitRepo(org, id);
  if (!row) return null;
  if (body.name !== undefined) row.name = body.name;
  if (body.commitPolicy !== undefined) row.commitPolicy = body.commitPolicy;
  if (body.baseBranch !== undefined) row.baseBranch = body.baseBranch;
  if (body.teamId !== undefined) row.teamId = body.teamId;
  if (body.isDefault === true) {
    for (const r of gitReposFor(org)) r.isDefault = false;
    row.isDefault = true;
  }
  row.updatedAt = new Date().toISOString();
  return row;
}

export function unregisterGitRepoMock(org: string, id: string): boolean {
  const before = gitReposFor(org).length;
  state.repos[org] = gitReposFor(org).filter((r) => r.id !== id);
  delete state.refCounts[id];
  return gitReposFor(org).length < before;
}
