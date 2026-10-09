import * as React from "react";
import { Stepper } from "@/components/stepper";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";

import { buildHelmCommand, createCluster, getCluster, issueRegistrationToken } from "@/api/clusters";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import type { ClusterStatus, CreateClusterResponse } from "@/api/types";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
import { formatCountdown } from "@/lib/time";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { ClusterStatusBadge } from "@/pages/clusters/status-badge";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const WAIT_TIMEOUT_MS = 10 * 60_000;

const STEPS = ["Details", "Install", "Connect"] as const;


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
      variant="secondary"
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
    <Badge variant={remaining === "expired" ? "danger" : "warning"}>
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
        <p className="text-sm u-muted">
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
        <p className="text-sm u-muted">
          Check that the agent was installed (`kubectl -n inari-system get pods`) and that the
          cluster has outbound HTTPS access to the control plane.
        </p>
        <Button
          variant="secondary"
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
      <Loader2 className="h-8 w-8 animate-spin u-brand" aria-hidden />
      <p className="font-medium">Waiting for the agent to connect…</p>
      <p className="text-sm u-muted">
        Run the Helm command above to install the agent. This page updates automatically once the
        agent dials home.
      </p>
      {cluster && <ClusterStatusBadge status={cluster.status} />}
    </div>
  );
}

// On a resumed registration the one-time token from step 1 is gone, so we
// issue a fresh one and rebuild the Helm command — the same install UX as a
// fresh registration.
function ResumedInstall({ clusterId, orgID }: { clusterId: string; orgID: string }) {
  const { token } = useAuth();
  const [install, setInstall] = React.useState<{ command: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const tok = await issueRegistrationToken(token, clusterId);
      setInstall({ command: buildHelmCommand(orgID, tok.token), expiresAt: tok.expiresAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue a registration token");
    } finally {
      setLoading(false);
    }
  };

  if (install) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <TokenCountdown expiresAt={install.expiresAt} />
        </div>
        <pre className="overflow-auto rounded-md u-raised p-3 font-mono text-xs">
          {install.command}
        </pre>
        <CopyButton value={install.command} label="Copy command" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm u-danger">{error}</p>}
      <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
        {loading ? "Issuing token…" : "Show install command"}
      </Button>
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
  const [labelsInput, setLabelsInput] = React.useState("env=dev");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<CreateClusterResponse | null>(null);

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
        <h1 className="page-header-title">Register cluster</h1>
        <p className="text-sm u-muted">
          Connect a Kubernetes cluster to Inari. The agent dials out — no inbound access or
          kubeconfig required.
        </p>
      </div>
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Cluster details</h2>
            <p className="card-lede">
              This creates a cluster record and issues a one-time registration token.
            </p>
          </div>
          <div className="card-body">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="cluster-name">Name</label>
                <Input
                  id="cluster-name"
                  value={name}
                  onChange={(v) => setName(v)}
                  placeholder="kind-dev"
                  required
                />
                {nameError && <p className="text-xs u-danger">{nameError}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="cluster-labels">Labels</label>
                <Input
                  id="cluster-labels"
                  value={labelsInput}
                  onChange={(v) => setLabelsInput(v)}
                  placeholder="env=dev, cloud=aws"
                />
                <p className="text-xs u-muted">
                  Comma-separated key=value pairs; used for fleet targeting.
                </p>
              </div>
              {submitError && <p className="text-sm u-danger">{submitError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name}>
                  {submitting ? "Registering…" : "Create registration token"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {step === 1 && created && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Install the agent</h2>
            <p className="card-lede">
              The token below is shown once and embeds cluster identity. Install the agent within
              the token lifetime.
            </p>
          </div>
          <div className="card-body">
            <div className="flex items-center justify-between gap-2 rounded-md border u-raised/40 p-3">
              <code className="truncate font-mono text-xs" data-testid="registration-token">
                {created.registrationToken}
              </code>
              <div className="flex items-center gap-2">
                <TokenCountdown expiresAt={created.tokenExpiresAt} />
                <CopyButton value={created.registrationToken} label="Copy token" />
              </div>
            </div>

            <div className="space-y-2">
              <pre className="overflow-auto rounded-md u-raised p-3 font-mono text-xs">
                {created.install.helmCommand}
              </pre>
              <CopyButton value={created.install.helmCommand} label="Copy command" />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>I&apos;ve installed it — watch for connection</Button>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && clusterId && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Waiting for connection</h2>
            <p className="card-lede">
              {created
                ? `Cluster "${created.cluster.name}" was registered.`
                : resumed.error
                  ? "Could not restore this registration."
                  : resumed.data
                    ? `Cluster "${resumed.data.name}".`
                    : "Restoring registration…"}
            </p>
          </div>
          <div className="card-body">
            {!created && resumed.error ? (
              <div className="space-y-3">
                <p className="text-sm u-danger">
                  This registration could not be restored — it may have been cancelled or belongs
                  to another tenant.
                </p>
                <Link to={tenantLink(tenant, "clusters/new")} className="btn btn-secondary btn-sm">Start a new registration</Link>
              </div>
            ) : (
              <>
                <WaitingForConnection clusterId={clusterId} />
                {!created && resumed.data && (
                  <ResumedInstall clusterId={clusterId} orgID={resumed.data.tenant} />
                )}
                <div className="flex justify-end">
                  <Link to={tenantLink(tenant, `clusters/${clusterId}`)} className="btn btn-secondary">Open cluster detail</Link>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
