import { apiFetch } from "@/api/client";
import { resolveTenant } from "@/tenant/current";

// Per-user Git connections (W5 UX over the W4 usergit endpoints): the console
// lists the caller's connected Git provider accounts for the current org,
// starts the server-driven OAuth authorize redirect, and disconnects.
// Responses are metadata-only — access/refresh tokens are held server-side
// and are never modeled, stored, or rendered here.
//
// TODO(contract-sync): the pinned OpenAPI snapshot does not yet include the
// usergit paths. The wire shapes below mirror the W4 contract; after
// `npm run sync:api -- <w4-server-version>` replace them with
// components["schemas"][...] imports from @/api/__generated__/schema.

// Server contract (inari-server internal/usergit Connection): scopes is a
// space/comma-separated string; GitHub App user tokens fall back to the
// requested scopes. apiBase is only set for self-hosted providers (GHE).
interface WireGitConnection {
  provider: string;
  providerLogin: string;
  scopes?: string | string[];
  apiBase?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
}

interface WireGitProvider {
  id: string;
  enabled: boolean;
  apiBase?: string | null;
}

interface WireListGitConnectionsOutputBody {
  connections?: WireGitConnection[];
  providers?: WireGitProvider[];
}

interface WireGitAuthorizeOutputBody {
  authorizeUrl: string;
}

export interface GitConnectionViewModel {
  provider: string;
  login: string;
  scopes: string[];
  apiBase: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface GitProviderViewModel {
  id: string;
  enabled: boolean;
  apiBase: string | null;
}

export interface GitConnectionsViewModel {
  connections: GitConnectionViewModel[];
  providers: GitProviderViewModel[];
}

function toConnectionViewModel(w: WireGitConnection): GitConnectionViewModel {
  return {
    provider: w.provider,
    login: w.providerLogin,
    scopes: Array.isArray(w.scopes)
      ? w.scopes
      : (w.scopes ?? "").split(/[\s,]+/).filter(Boolean),
    apiBase: w.apiBase ?? null,
    createdAt: w.createdAt,
    lastUsedAt: w.lastUsedAt ?? null,
  };
}

function toProviderViewModel(w: WireGitProvider): GitProviderViewModel {
  return { id: w.id, enabled: w.enabled, apiBase: w.apiBase ?? null };
}

function basePath(tenant: string): string {
  return `/tenants/${encodeURIComponent(resolveTenant(tenant))}/git-connections`;
}

export async function listGitConnections(
  token: string | undefined,
  tenant: string,
): Promise<GitConnectionsViewModel> {
  const res = await apiFetch<WireListGitConnectionsOutputBody>(basePath(tenant), {
    token,
  });
  return {
    connections: (res.connections ?? []).map(toConnectionViewModel),
    providers: (res.providers ?? []).map(toProviderViewModel),
  };
}

// Returns the provider-side authorize URL the browser should navigate to; the
// server completes the OAuth dance and redirects back to the settings page.
export async function getGitConnectionAuthorizeUrl(
  token: string | undefined,
  tenant: string,
  provider: string,
): Promise<string> {
  const res = await apiFetch<WireGitAuthorizeOutputBody>(
    `${basePath(tenant)}/${encodeURIComponent(provider)}/authorize`,
    { token },
  );
  return res.authorizeUrl;
}

export async function deleteGitConnection(
  token: string | undefined,
  tenant: string,
  provider: string,
): Promise<void> {
  await apiFetch<unknown>(
    `${basePath(tenant)}/${encodeURIComponent(provider)}`,
    { token, method: "DELETE" },
  );
}
