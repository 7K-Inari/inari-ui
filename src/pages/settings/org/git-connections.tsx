import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FolderGit2, Github, Gitlab } from "lucide-react";

import { ApiError } from "@/api/client";
import {
  deleteGitConnection,
  getGitConnectionAuthorizeUrl,
  listGitConnections,
  type GitConnectionViewModel,
  type GitProviderViewModel,
} from "@/api/git-connections";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

const PROVIDER_META: Record<
  string,
  { label: string; Icon: typeof Github }
> = {
  github: { label: "GitHub", Icon: Github },
  gitlab: { label: "GitLab", Icon: Gitlab },
  forgejo: { label: "Forgejo", Icon: FolderGit2 },
};

function providerMeta(id: string): { label: string; Icon: typeof Github } {
  return PROVIDER_META[id] ?? { label: id, Icon: FolderGit2 };
}

function callbackErrorMessage(provider: string | null, code: string | null): string {
  const { label } = providerMeta(provider ?? "");
  const target = provider ? ` to ${label}` : "";
  if (code === "access_denied") {
    return `Authorization${target} was denied. No connection was created.`;
  }
  return `Failed to connect${target}${code ? ` (${code})` : ""}.`;
}

function ProviderRow({
  provider,
  connection,
  onConnect,
  onDisconnect,
}: {
  provider: GitProviderViewModel;
  connection: GitConnectionViewModel | null;
  onConnect: (provider: GitProviderViewModel) => void;
  onDisconnect: (connection: GitConnectionViewModel) => void;
}) {
  const { label, Icon } = providerMeta(provider.id);
  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-2">
        <span className="inline-flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4" aria-hidden />
          {label}
          {!provider.enabled && <Badge variant="muted">not available</Badge>}
        </span>
      </td>
      <td className="px-4 py-2">
        {connection ? (
          connection.login
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2">
        {connection && connection.scopes.length > 0 ? (
          <span className="inline-flex flex-wrap gap-1">
            {connection.scopes.map((scope) => (
              <Badge key={scope} variant="muted">
                {scope}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2 font-mono text-xs">
        {connection?.apiBase ?? provider.apiBase ?? "—"}
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {connection ? formatRelative(connection.createdAt) : "—"}
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {connection
          ? connection.lastUsedAt
            ? formatRelative(connection.lastUsedAt)
            : "never"
          : "—"}
      </td>
      <td className="px-4 py-2">
        {connection ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDisconnect(connection)}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={!provider.enabled}
            onClick={() => onConnect(provider)}
          >
            Connect
          </Button>
        )}
      </td>
    </tr>
  );
}

export function GitConnectionsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    data,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listGitConnections(t, tenant), [tenant]);

  const [notice, setNotice] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // The route param changes on tenant switch without remounting — clear
  // banners so feedback from one org can't leak into another. Declared
  // before the callback effect so a mount-time callback banner wins.
  React.useEffect(() => {
    setNotice(null);
    setActionError(null);
  }, [tenant]);

  // Callback return states from the server-driven OAuth round-trip: the
  // server redirects back here with ?connected=<provider> on success or
  // ?provider=<id>&error=<code> on failure/denial. Strip the params after
  // mapping them to a banner so refreshes don't re-show stale state.
  React.useEffect(() => {
    const connected = searchParams.get("connected");
    const failedProvider = searchParams.get("provider");
    const code = searchParams.get("error");
    if (!connected && !code) return;
    if (connected) {
      setNotice(`${providerMeta(connected).label} connected.`);
    } else {
      setActionError(callbackErrorMessage(failedProvider, code));
    }
    refetch();
    navigate(".", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fail =(err: unknown, fallback: string) =>
    setActionError(err instanceof ApiError ? err.message : fallback);

  const connect = async (provider: GitProviderViewModel) => {
    setNotice(null);
    setActionError(null);
    try {
      const url = await getGitConnectionAuthorizeUrl(token, tenant, provider.id);
      window.location.assign(url);
    } catch (err) {
      fail(err, `Failed to start ${providerMeta(provider.id).label} connect`);
    }
  };

  const disconnect = async (connection: GitConnectionViewModel) => {
    const { label } = providerMeta(connection.provider);
    if (!window.confirm(`Disconnect ${label} (${connection.login})?`)) return;
    setNotice(null);
    setActionError(null);
    try {
      await deleteGitConnection(token, tenant, connection.provider);
      setNotice(`${label} disconnected.`);
      refetch();
    } catch (err) {
      fail(err, `Failed to disconnect ${label}`);
    }
  };

  const providers = data?.providers ?? [];
  const connections = data?.connections ?? [];
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Git connections"
        description="Your personal Git provider accounts for this organization. Credentials are stored server-side — tokens are never shown here."
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load git connections: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !data && (
        <p className="text-sm text-muted-foreground">Loading git connections…</p>
      )}

      {notice && (
        <Card>
          <CardContent className="py-3 text-sm">{notice}</CardContent>
        </Card>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">
            {actionError}
          </CardContent>
        </Card>
      )}

      {!error && data && providers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No Git providers are configured for this organization.
          </CardContent>
        </Card>
      )}

      {providers.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Connected login</th>
                <th className="px-4 py-2 font-medium">Scopes</th>
                <th className="px-4 py-2 font-medium">API base</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Last used</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  connection={byProvider.get(provider.id) ?? null}
                  onConnect={connect}
                  onDisconnect={disconnect}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
