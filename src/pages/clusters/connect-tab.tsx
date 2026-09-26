import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { getAccessInfo, getCluster, updateClusterSettings } from "@/api/clusters";
import { ApiError } from "@/api/client";
import { getFeatures } from "@/api/features";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { usePermissions } from "@/auth/permissions-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/pages/cloud-accounts/copy-button";
import { canManageKubectlProxy } from "@/pages/clusters/kubectl-proxy";
import { useTenant } from "@/tenant/tenant-context";

function kubeloginSnippet(issuerUrl: string, clientId: string, org: string): string {
  return [
    `kubectl config set-credentials inari-${org} \\`,
    "  --exec-command=kubelogin \\",
    "  --exec-api-version=client.authentication.k8s.io/v1 \\",
    "  --exec-arg=get-token \\",
    `  --exec-arg=--oidc-issuer-url=${issuerUrl} \\`,
    `  --exec-arg=--oidc-client-id=${clientId} \\`,
    "  --exec-arg=--oidc-extra-scope=organization",
  ].join("\n");
}

type Reachability =
  | { status: "checking" }
  | { status: "reachable"; version: string }
  | { status: "unreachable" };

// Browser-side probe: the control plane cannot reach the user's localhost,
// so the console polls kubectl proxy directly. Any failure means "not
// reachable yet" — never a hard error (mixed-content blocking on HTTPS
// consoles surfaces the same way).
function useProxyReachability(port: string): Reachability {
  const [state, setState] = React.useState<Reachability>({ status: "checking" });
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // An empty port would normalize to :80 in fetch — never probe it.
    if (!port) {
      setState({ status: "unreachable" });
      return;
    }
    setState({ status: "checking" });
    const probe = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/version`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { gitVersion?: string; major?: string; minor?: string };
        if (cancelled) return;
        setState({
          status: "reachable",
          version: data.gitVersion ?? [data.major, data.minor].filter(Boolean).join("."),
        });
        return; // reachable: stop polling
      } catch {
        if (!cancelled) setState({ status: "unreachable" });
      }
      if (!cancelled) timer = setTimeout(probe, 3_000);
    };
    probe();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [port]);
  return state;
}

export function ConnectTab({ clusterId }: { clusterId: string }) {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { orgRoles } = usePermissions();
  const canWrite = canManageKubectlProxy(orgRoles, tenant);

  const { data: features, loading: featuresLoading } = useAsyncResource(
    (t) => getFeatures(t),
    [],
  );
  const {
    data: cluster,
    loading: clusterLoading,
    refetch,
  } = useAsyncResource((t) => getCluster(t, clusterId), [clusterId]);
  const enabled = cluster?.kubectlProxyEnabled === true;
  const { data: accessInfo } = useAsyncResource((t) => getAccessInfo(t, clusterId), [clusterId], {
    enabled,
  });

  const [port, setPort] = React.useState("8001");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const reachability = useProxyReachability(port);

  if ((featuresLoading && !features) || (clusterLoading && !cluster)) {
    return <p className="text-sm text-muted-foreground">Loading connection setup…</p>;
  }

  if (features && !features.kubectlProxy.enabled) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          kubectl proxy access is disabled globally on this control plane
          (INARI_DISABLE_KUBECTL_PROXY).
        </CardContent>
      </Card>
    );
  }
  if (!cluster) return null;

  const toggle = async (disabled: boolean) => {
    setActionError(null);
    setPending(true);
    try {
      await updateClusterSettings(token, cluster.id, disabled, tenant);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update cluster settings");
    } finally {
      setPending(false);
    }
  };

  if (!enabled) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
          <p>kubectl proxy access is disabled for this cluster.</p>
          {canWrite && (
            <div>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => toggle(false)}>
                Enable kubectl proxy
              </Button>
            </div>
          )}
          {actionError && <p className="text-destructive">{actionError}</p>}
        </CardContent>
      </Card>
    );
  }

  const proxyCommand = `kubectl proxy --port=${port}`;

  return (
    <div className="space-y-4">
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1. Configure kubectl authentication</CardTitle>
          <CardDescription>
            The cluster authenticates kubectl via OIDC (kubelogin). Install kubelogin, then add
            the exec credential below to the kubeconfig that already points at this cluster's API
            server — the control plane never stores cluster endpoints or credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {accessInfo ? (
            <>
              <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                {kubeloginSnippet(accessInfo.issuerUrl, accessInfo.kubectlClientId, accessInfo.organization)}
              </pre>
              <div>
                <CopyButton
                  value={kubeloginSnippet(accessInfo.issuerUrl, accessInfo.kubectlClientId, accessInfo.organization)}
                  label="Copy"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading access info…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">2. Start the proxy</CardTitle>
          <CardDescription>
            Run this on the machine your e2e tests execute on. It proxies the cluster API — using
            your own kubeconfig credentials — on localhost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="proxy-port" className="text-xs text-muted-foreground">
              Proxy port
            </Label>
            <Input
              id="proxy-port"
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-24 font-mono"
              inputMode="numeric"
            />
          </div>
          <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
            {proxyCommand}
          </pre>
          <div>
            <CopyButton value={proxyCommand} label="Copy" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">3. Verify reachability</CardTitle>
          <CardDescription>
            The console probes http://127.0.0.1:{port}/version from your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reachability.status === "reachable" ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
              <span className="font-medium">Proxy reachable</span>
              <Badge variant="success">Kubernetes {reachability.version}</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>Waiting for the proxy on 127.0.0.1:{port}…</span>
            </div>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => toggle(true)}>
            Disable for this cluster
          </Button>
        </div>
      )}
    </div>
  );
}
