import * as React from "react";
import { Alert, Badge, Button, Card } from "7k-design-system/react";

import { useAsyncResource } from "@/api/hooks";
import {
  disableInstanceVerification,
  getInstanceVerification,
  getInstanceVerificationRun,
  runInstanceVerification,
} from "@/api/verification";
import type { ResourceInstanceDetail } from "@/api/types";
import { useAuth } from "@/auth/auth-context";
import { VerificationPolicyForm } from "@/components/verification/policy-form";

function VerificationBadge({ status }: { status: string }) {
  const variant = status === "passed" ? "success" : status === "failed" ? "danger" : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

export function VerificationCard({ resource }: { resource: ResourceInstanceDetail }) {
  const { token } = useAuth();
  const verification = useAsyncResource(
    (authToken) => getInstanceVerification(authToken, resource.tenant, resource.id),
    [resource.tenant, resource.id],
    { refetchIntervalMs: 15_000 },
  );
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const latestRunId = verification.data?.runs?.[0]?.runId;
  const activeRunId = selectedRunId ?? latestRunId;
  const run = useAsyncResource(
    (authToken) => getInstanceVerificationRun(authToken, resource.tenant, resource.id, activeRunId!),
    [resource.tenant, resource.id, activeRunId],
    { enabled: Boolean(activeRunId), refetchIntervalMs: 15_000 },
  );
  const [editing, setEditing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const dryRun = async () => {
    setBusy(true); setMessage(null);
    try {
      const result = await runInstanceVerification(token, resource.tenant, resource.id, crypto.randomUUID(), true);
      setMessage(result.preview ? "Manual run preview passed with zero side effects. No run was created." : "Preview completed; no run was created.");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Manual run preview failed"); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMessage(null);
    try {
      await disableInstanceVerification(token, resource.tenant, resource.id);
      setMessage("Future verification triggers are disabled. Active work and retained history were not deleted.");
      verification.refetch();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Disable failed"); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="card-header"><div className="flex items-center justify-between gap-4">
        <div><h2 className="mono-label">Environment verification</h2>
          <p className="card-lede">Signed-suite evidence is separate from ArgoCD health and sync.</p></div>
        {run.data && <VerificationBadge status={run.data.status} />}
      </div></div>
      <div className="card-body space-y-4">
        {verification.error && <Alert variant="danger">{verification.error.message}</Alert>}
        {run.error && <Alert variant="danger">{run.error.message}</Alert>}
        {verification.data && !verification.data.gate.renderAvailable && (
          <Alert variant="info">Policy preview and saving are available. Workflow rendering and deployed runs are stopped: {verification.data.gate.reason ?? "external renderer gate is closed"}.</Alert>
        )}
        {!verification.loading && !verification.data?.policy && <p className="text-sm u-muted">No verification policy is configured for this exact application instance.</p>}
        {verification.data?.policy && (
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div><dt className="u-muted">Policy revision</dt><dd>{verification.data.policy.policyRevision}</dd></div>
            <div><dt className="u-muted">Profile</dt><dd>{verification.data.policy.binding.profile}</dd></div>
            <div className="md:col-span-2"><dt className="u-muted">Suite digest</dt><dd className="break-all font-mono text-xs">{verification.data.policy.binding.suiteDigest}</dd></div>
            <div className="md:col-span-2"><dt className="u-muted">Application digest</dt><dd className="break-all font-mono text-xs">{verification.data.policy.binding.appArtifactDigest}</dd></div>
          </dl>
        )}
        {run.data && (
          <div className="space-y-2 rounded-md u-raised p-3" data-testid="verification-run-detail">
            <div className="flex flex-wrap items-center gap-2"><strong>{run.data.runId}</strong><VerificationBadge status={run.data.status} /><span>attempt {run.data.latestAttempt}</span></div>
            <p className="break-all font-mono text-xs">Revision {run.data.appRevision}</p>
            {run.data.reasonCode && <p className="text-sm">{run.data.reasonCode}</p>}
            {run.data.status === "failed" && <Alert variant="danger">Verification failed for this exact revision. No automatic rollback was performed.</Alert>}
            {run.data.links ? <div className="flex flex-wrap gap-2">
              <a className="btn btn-secondary btn-sm" href={run.data.links.workflow} target="_blank" rel="noreferrer">Open Workflow (new tab)</a>
              <a className="btn btn-secondary btn-sm" href={run.data.links.logs} target="_blank" rel="noreferrer">Open logs (new tab)</a>
              <a className="btn btn-secondary btn-sm" href={run.data.links.artifacts} target="_blank" rel="noreferrer">Open artifacts (new tab)</a>
            </div> : <p className="text-sm u-muted">No current Workflow log or artifact links are available.</p>}
          </div>
        )}
        {verification.data?.runs && verification.data.runs.length > 0 && <div className="overflow-x-auto"><table className="table text-sm"><thead><tr><th>Run</th><th>Status</th><th>Trigger</th><th>Profile</th></tr></thead><tbody>
          {verification.data.runs.map((item) => <tr key={item.runId}><td><button className="underline" onClick={() => setSelectedRunId(item.runId)}>{item.runId}</button></td><td>{item.status}</td><td>{item.trigger.kind}</td><td>{item.profile}</td></tr>)}
        </tbody></table></div>}
        {message && <Alert variant="info">{message}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing((value) => !value)}>{editing ? "Close policy editor" : "Configure verification"}</Button>
          {verification.data?.policy && <Button variant="secondary" disabled={busy} onClick={dryRun}>Preview manual run</Button>}
          {verification.data?.policy?.enabled && <Button variant="ghost" disabled={busy} onClick={disable}>Disable future triggers</Button>}
        </div>
        {editing && <VerificationPolicyForm key={verification.data?.policy?.id ?? "new"} resource={resource} current={verification.data?.policy} onSaved={() => { setEditing(false); verification.refetch(); }} />}
      </div>
    </Card>
  );
}
