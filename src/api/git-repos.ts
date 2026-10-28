import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Org-scoped GitOps repo registry (Feature A, M1W1): the console lists,
// registers, edits, and unregisters team/platform GitOps state repos.
//
// TODO(contract-sync): the pinned OpenAPI snapshot does not yet include the
// git-repos paths. The wire shapes below mirror the M1W1 contract
// (inari-server internal/types.TenantGitRepo, internal/gitrepos/http.go);
// after `npm run sync:api -- <m1w1-server-version>` replace them with
// components["schemas"][...] imports from @/api/__generated__/schema.

export type GitRepoProvider = "github";
export type GitRepoScope = "platform" | "team";
export type GitRepoCommitPolicy = "direct" | "pull_request";

interface WireTenantGitRepo {
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

interface WireGitProviderStatus {
  state: "ok" | "not_installed" | "invalid_credentials" | "rate_limited" | "unknown";
  authModel: string;
  installationId?: number;
  apiBase?: string;
  checkedAt: string;
}

interface WireListGitReposOutputBody {
  repos?: WireTenantGitRepo[];
}

interface WireGitRepoOutputBody {
  repo: WireTenantGitRepo;
  gitProviderStatus?: WireGitProviderStatus;
}

interface WireUnregisterOutputBody {
  unregistered: boolean;
  mode?: string;
}

export interface GitRepoViewModel {
  id: string;
  orgId: string;
  name: string;
  repo: string;
  provider: GitRepoProvider;
  scope: GitRepoScope;
  teamId: string | null;
  commitPolicy: GitRepoCommitPolicy;
  baseBranch: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GitProviderStatusViewModel {
  state: "ok" | "not_installed" | "invalid_credentials" | "rate_limited" | "unknown";
  authModel: string;
  installationId: number | null;
  apiBase: string | null;
  checkedAt: string;
}

export interface RegisterGitRepoInput {
  name: string;
  repo: string;
  provider?: GitRepoProvider;
  scope?: GitRepoScope;
  teamId?: string;
  commitPolicy?: GitRepoCommitPolicy;
  baseBranch?: string;
  isDefault?: boolean;
}

export interface UpdateGitRepoInput {
  name?: string;
  commitPolicy?: GitRepoCommitPolicy;
  baseBranch?: string;
  teamId?: string;
  isDefault?: boolean;
}

function toViewModel(w: WireTenantGitRepo): GitRepoViewModel {
  return {
    id: w.id,
    orgId: w.orgId,
    name: w.name,
    repo: w.repo,
    provider: w.provider,
    scope: w.scope,
    teamId: w.teamId ?? null,
    commitPolicy: w.commitPolicy,
    baseBranch: w.baseBranch,
    isDefault: w.isDefault,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

function toStatusViewModel(w: WireGitProviderStatus): GitProviderStatusViewModel {
  return {
    state: w.state,
    authModel: w.authModel,
    installationId: w.installationId ?? null,
    apiBase: w.apiBase ?? null,
    checkedAt: w.checkedAt,
  };
}

function basePath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}/git-repos`;
}

export async function listGitRepos(
  token: string | undefined,
  tenant: string,
): Promise<GitRepoViewModel[]> {
  const res = await apiFetch<WireListGitReposOutputBody>(basePath(tenant), {
    token,
  });
  return (res.repos ?? []).map(toViewModel);
}

export async function registerGitRepo(
  token: string | undefined,
  tenant: string,
  body: RegisterGitRepoInput,
): Promise<GitRepoViewModel> {
  const res = await apiFetch<WireGitRepoOutputBody>(basePath(tenant), {
    token,
    method: "POST",
    body,
  });
  return toViewModel(res.repo);
}

export interface GitRepoDetail extends GitRepoViewModel {
  status: GitProviderStatusViewModel | null;
}

export async function getGitRepo(
  token: string | undefined,
  tenant: string,
  id: string,
): Promise<GitRepoDetail> {
  const res = await apiFetch<WireGitRepoOutputBody>(
    `${basePath(tenant)}/${encodeURIComponent(id)}`,
    { token },
  );
  return {
    ...toViewModel(res.repo),
    status: res.gitProviderStatus ? toStatusViewModel(res.gitProviderStatus) : null,
  };
}

export async function updateGitRepo(
  token: string | undefined,
  tenant: string,
  id: string,
  body: UpdateGitRepoInput,
): Promise<GitRepoViewModel> {
  const res = await apiFetch<WireGitRepoOutputBody>(
    `${basePath(tenant)}/${encodeURIComponent(id)}`,
    { token, method: "PATCH", body },
  );
  return toViewModel(res.repo);
}

export async function unregisterGitRepo(
  token: string | undefined,
  tenant: string,
  id: string,
  opts?: { force?: boolean; mode?: "orphan" | "teardown" },
): Promise<void> {
  const params = new URLSearchParams();
  if (opts?.force) params.set("force", "true");
  if (opts?.mode) params.set("mode", opts.mode);
  const qs = params.toString();
  await apiFetch<WireUnregisterOutputBody>(
    `${basePath(tenant)}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`,
    { token, method: "DELETE" },
  );
}
