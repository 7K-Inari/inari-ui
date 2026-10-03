import * as React from "react";

import { downloadKubeconfig, getAccessInfo, type KubeconfigMode } from "@/api/clusters";
import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import type { ClusterDetail } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/pages/cloud-accounts/copy-button";
import { useTenant } from "@/tenant/tenant-context";

const PREREQS: { tool: string; description: string; commands: string[] }[] = [
  {
    tool: "inari-cli",
    description: "Authenticates you and merges kubeconfig entries (inari cluster connect).",
    commands: ["brew install 7k-inari/tap/inari"],
  },
  {
    tool: "kubelogin",
    description: "kubectl exec credential plugin that mints OIDC tokens on demand.",
    commands: ["brew install int128/kubelogin/kubelogin", "kubectl krew install oidc-login"],
  },
];

function CommandRow({ command }: { command: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
        {command}
      </code>
      <CopyButton value={command} label="Copy" />
    </div>
  );
}

export function ConnectTab({ cluster }: { cluster: ClusterDetail }) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const {
    data: accessInfo,
    loading,
    error,
  } = useAsyncResource((t) => getAccessInfo(t, cluster.id, tenant), [cluster.id, tenant]);

  const [modeChoice, setModeChoice] = React.useState<KubeconfigMode | null>(null);
  const [server, setServer] = React.useState("");
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load connection info: {error.message}
      </p>
    );
  }
  if (loading && !accessInfo) {
    return <p className="text-sm text-muted-foreground">Loading connection info…</p>;
  }
  if (!accessInfo) return null;

  const kubectlEnabled = accessInfo.kubectlAccessEnabled;
  const tunnelAvailable = accessInfo.tunnelAvailable;
  // Default: gateway when the tunnel is live, direct otherwise.
  const mode: KubeconfigMode = modeChoice ?? (tunnelAvailable ? "gateway" : "direct");

  const connectCommand =
    mode === "direct" && server.trim()
      ? `inari cluster connect ${cluster.id} --server ${server.trim()}`
      : `inari cluster connect ${cluster.id}`;

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadKubeconfig(
        token,
        cluster.id,
        { mode, server: mode === "direct" && server.trim() ? server.trim() : undefined },
        tenant,
      );
    } catch (err) {
      setDownloadError(
        err instanceof ApiError ? err.message : "Failed to download kubeconfig",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!kubectlEnabled && (
        <Card>
          <CardContent className="py-4 text-sm text-destructive">
            kubectl access is disabled for this platform by an administrator. The commands and
            download below will not work until it is re-enabled.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection status</CardTitle>
          <CardDescription>
            kubectl talks to this cluster either through the Inari gateway tunnel or directly to
            its API server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block size-2 rounded-full ${tunnelAvailable ? "bg-green-500" : "bg-muted-foreground"}`}
              aria-hidden
            />
            {tunnelAvailable
              ? "Gateway tunnel available — the cluster dials out, so no inbound access is needed."
              : "Gateway tunnel unavailable."}
          </div>
          {!tunnelAvailable && (
            <p className="text-sm text-muted-foreground">
              {accessInfo.tunnelUnavailableReason ??
                "The tunnel agent is not connected. Upgrade the inari-agent chart on this cluster to enable gateway mode."}{" "}
              Direct mode still works if the API server is reachable from your machine.
            </p>
          )}
          {accessInfo.proxyUrl && (
            <p className="text-sm text-muted-foreground">
              Gateway endpoint: <span className="font-mono text-xs">{accessInfo.proxyUrl}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prerequisites</CardTitle>
          <CardDescription>Install these tools on your machine first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PREREQS.map((p) => (
            <div key={p.tool} className="space-y-1.5">
              <p className="text-sm font-medium">{p.tool}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
              {p.commands.map((cmd) => (
                <CommandRow key={cmd} command={cmd} />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect</CardTitle>
          <CardDescription>
            Pick how kubectl reaches the cluster, then run the commands or download a ready-made
            kubeconfig.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2" role="radiogroup" aria-label="Connection mode">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="connect-mode"
                className="mt-1"
                checked={mode === "gateway"}
                disabled={!tunnelAvailable}
                onChange={() => setModeChoice("gateway")}
              />
              <span>
                <span className="font-medium">Gateway (via Inari proxy)</span>
                <span className="block text-xs text-muted-foreground">
                  Works for private clusters; requests are tunneled and authorized by the
                  platform.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="connect-mode"
                className="mt-1"
                checked={mode === "direct"}
                onChange={() => setModeChoice("direct")}
              />
              <span>
                <span className="font-medium">Direct</span>
                <span className="block text-xs text-muted-foreground">
                  Your machine talks to the API server URL directly (OIDC must be configured on
                  the cluster).
                </span>
              </span>
            </label>
          </div>

          {mode === "direct" && (
            <div className="space-y-1.5">
              <Label htmlFor="direct-server-url">API server URL</Label>
              <Input
                id="direct-server-url"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="https://api.my-cluster.example.com"
              />
            </div>
          )}

          <div className="space-y-2">
            <CommandRow command="inari login" />
            <CommandRow command={connectCommand} />
          </div>

          {downloadError && <p className="text-sm text-destructive">{downloadError}</p>}
          <div className="flex items-center gap-3">
            <Button
              onClick={download}
              disabled={downloading || !kubectlEnabled}
              title={
                !kubectlEnabled ? "kubectl access is disabled for this platform" : undefined
              }
            >
              {downloading ? "Downloading…" : "Download kubeconfig"}
            </Button>
            {!kubectlEnabled && (
              <p className="text-xs text-muted-foreground">
                Unavailable while kubectl access is disabled.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
