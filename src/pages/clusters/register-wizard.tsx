import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";

import { createCluster, getCluster } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import type { ClusterStatus, CreateClusterResponse } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCountdown } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { ClusterStatusBadge } from "@/pages/clusters/status-badge";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const WAIT_TIMEOUT_MS = 10 * 60_000;

const STEPS = ["Details", "Install", "Connect"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Wizard progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={
              i <= current
                ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
                : "flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground"
            }
            aria-current={i === current ? "step" : undefined}
          >
            {i + 1}
          </span>
          <span className={i <= current ? "font-medium" : "text-muted-foreground"}>
            {label}
          </span>
          {i < STEPS.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

function parseLabels(input: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const pair of input.split(",")) {
    const [k, v] = pair.split("=").map((s) => s.trim());
    if (k && v) labels[k] = v;
  }
  return labels;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard unavailable (e.g. insecure context)
        }
      }}
    >
      <Copy className="mr-1" /> {copied ? "Copied" : label}
    </Button>
  );
}

function TokenCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = formatCountdown(expiresAt, now);
  return (
    <Badge variant={remaining === "expired" ? "destructive" : "warning"}>
      {remaining === "expired" ? "Token expired" : `Token expires in ${remaining}`}
    </Badge>
  );
}

function WaitingForConnection({ clusterId }: { clusterId: string }) {
  const { token } = useAuth();
  const [cluster, setCluster] = React.useState<{
    status: ClusterStatus;
    k8sVersion: string | null;
  } | null>(null);
  const [timedOut, setTimedOut] = React.useState(false);
  const [pollKey, setPollKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let delay = 2_000;
    let elapsed = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const detail = await getCluster(token, clusterId);
        if (cancelled) return;
        setCluster(detail);
        if (detail.status === "connected") return;
      } catch {
        // transient error; keep polling
      }
      if (cancelled) return;
      elapsed += delay;
      if (elapsed >= WAIT_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      delay = Math.min(delay * 1.5, 10_000);
      timer = setTimeout(poll, delay);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clusterId, token, pollKey]);

  if (cluster?.status === "connected") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
        <p className="text-lg font-semibold">Cluster is online</p>
        <p className="text-sm text-muted-foreground">
          The agent connected and capability discovery has started
          {cluster.k8sVersion ? ` — Kubernetes ${cluster.k8sVersion}` : ""}.
        </p>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="font-medium">Still waiting for the agent to connect…</p>
        <p className="text-sm text-muted-foreground">
          Check that the manifest was applied (`kubectl -n inari-system get pods`) and that the
          cluster has outbound HTTPS access to the control plane.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setTimedOut(false);
            setPollKey((k) => k + 1);
          }}
        >
          Keep waiting
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="font-medium">Waiting for the agent to connect…</p>
      <p className="text-sm text-muted-foreground">
        Apply the manifest above to your cluster. This page updates automatically once the agent
        dials home.
      </p>
      {cluster && <ClusterStatusBadge status={cluster.status} />}
    </div>
  );
}

export function RegisterWizardPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = React.useState(() => (searchParams.get("cluster") ? 2 : 0));
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [labelsInput, setLabelsInput] = React.useState("env=dev");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<CreateClusterResponse | null>(null);
  const [installTab, setInstallTab] = React.useState<"manifest" | "helm">("manifest");

  const resumeId = searchParams.get("cluster");
  const resumed = useAsyncResource(
    (t) => getCluster(t, resumeId!),
    [resumeId],
    { enabled: step === 2 && !created && !!resumeId },
  );

  const clusterId = created?.cluster.id ?? resumeId;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!NAME_PATTERN.test(name)) {
      setNameError("Use lowercase letters, numbers, and dashes (e.g. kind-dev).");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createCluster(token, tenant, {
        name,
        description: description || undefined,
        labels: parseLabels(labelsInput),
      });
      setCreated(res);
      setStep(1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to register cluster");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Register cluster</h1>
        <p className="text-sm text-muted-foreground">
          Connect a Kubernetes cluster to Inari. The agent dials out — no inbound access or
          kubeconfig required.
        </p>
      </div>
      <StepIndicator current={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cluster details</CardTitle>
            <CardDescription>
              This creates a cluster record and issues a one-time registration token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cluster-name">Name</Label>
                <Input
                  id="cluster-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="kind-dev"
                  required
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cluster-description">Description (optional)</Label>
                <Input
                  id="cluster-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cluster-labels">Labels</Label>
                <Input
                  id="cluster-labels"
                  value={labelsInput}
                  onChange={(e) => setLabelsInput(e.target.value)}
                  placeholder="env=dev, cloud=aws"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated key=value pairs; used for fleet targeting.
                </p>
              </div>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name}>
                  {submitting ? "Registering…" : "Create registration token"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 1 && created && (
        <Card>
          <CardHeader>
            <CardTitle>Install the agent</CardTitle>
            <CardDescription>
              The token below is shown once and embeds cluster identity. Apply the manifest within
              the token lifetime.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 p-3">
              <code className="truncate font-mono text-xs" data-testid="registration-token">
                {created.registrationToken}
              </code>
              <div className="flex items-center gap-2">
                <TokenCountdown expiresAt={created.tokenExpiresAt} />
                <CopyButton value={created.registrationToken} label="Copy token" />
              </div>
            </div>

            <div className="flex gap-1" role="tablist" aria-label="Install method">
              <Button
                role="tab"
                aria-selected={installTab === "manifest"}
                variant={installTab === "manifest" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setInstallTab("manifest")}
              >
                kubectl manifest
              </Button>
              {created.install.helmCommand && (
                <Button
                  role="tab"
                  aria-selected={installTab === "helm"}
                  variant={installTab === "helm" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setInstallTab("helm")}
                >
                  Helm
                </Button>
              )}
            </div>

            {installTab === "manifest" ? (
              <div className="space-y-2">
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {created.install.manifestYaml}
                </pre>
                <CopyButton value={created.install.manifestYaml} label="Copy manifest" />
              </div>
            ) : (
              <div className="space-y-2">
                <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {created.install.helmCommand}
                </pre>
                <CopyButton value={created.install.helmCommand!} label="Copy command" />
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>I&apos;ve applied it — watch for connection</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && clusterId && (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for connection</CardTitle>
            <CardDescription>
              {created
                ? `Cluster "${created.cluster.name}" was registered.`
                : resumed.data
                  ? `Cluster "${resumed.data.name}".`
                  : "Restoring registration…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WaitingForConnection clusterId={clusterId} />
            <div className="flex justify-end">
              <Button asChild variant="outline">
                <Link to={tenantLink(tenant, `clusters/${clusterId}`)}>Open cluster detail</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
