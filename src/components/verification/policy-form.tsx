import * as React from "react";
import { Alert, Button, Input } from "7k-design-system/react";

import {
  previewInstanceVerification,
  saveInstanceVerification,
  type VerificationPolicy,
  type VerificationPolicyPreview,
} from "@/api/verification";
import type { ResourceInstanceDetail } from "@/api/types";
import { useAuth } from "@/auth/auth-context";

function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function specDigest(spec: Record<string, unknown>, existing?: string): Promise<string> {
  if (existing) return existing;
  if (!globalThis.crypto?.subtle) throw new Error("Secure browser cryptography is required to bind the exact spec digest.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJSON(spec)));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

interface Props {
  resource: ResourceInstanceDetail;
  current?: VerificationPolicy;
  onSaved: () => void;
}

export function VerificationPolicyForm({ resource, current, onSaved }: Props) {
  const { token } = useAuth();
  const binding = current?.binding;
  const [grantId, setGrantId] = React.useState(binding?.suiteGrantId ?? "");
  const [suiteDigest, setSuiteDigest] = React.useState(binding?.suiteDigest ?? "");
  const [profile, setProfile] = React.useState(binding?.profile ?? "stage");
  const [parameterContract, setParameterContract] = React.useState(binding?.parameterContract ?? "inari.smoke.params.v1");
  const [timeout, setTimeout] = React.useState(current?.timeout ?? "10m");
  const [revisionTrigger, setRevisionTrigger] = React.useState(current?.triggers.onRevisionChange.enabled ?? true);
  const [manualTrigger, setManualTrigger] = React.useState(current?.triggers.manual.enabled ?? true);
  const [syncTrigger, setSyncTrigger] = React.useState(current?.triggers.onSync.enabled ?? false);
  const [cronTrigger, setCronTrigger] = React.useState(current?.triggers.cron.enabled ?? false);
  const [schedule, setSchedule] = React.useState(current?.triggers.cron.schedules?.join(",") ?? "0 2 * * *");
  const [maxActive, setMaxActive] = React.useState(String(current?.concurrency.maxActive ?? 1));
  const [maxPending, setMaxPending] = React.useState(String(current?.concurrency.maxPending ?? 1));
  const [workflowTTL, setWorkflowTTL] = React.useState(String(current?.retention.workflowTTLSeconds ?? 3600));
  const [resultDays, setResultDays] = React.useState(String(current?.retention.resultDays ?? 30));
  const [endpointIds, setEndpointIds] = React.useState(current?.notifications?.endpointIds?.join(",") ?? "");
  const [failureAction, setFailureAction] = React.useState(current?.failureAction ?? "pausePromotion");
  const [preview, setPreview] = React.useState<VerificationPolicyPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const buildPolicy = async (): Promise<VerificationPolicy> => ({
    policyRevision: (current?.policyRevision ?? 0) + 1,
    enabled: true,
    instanceId: resource.id,
    instanceUid: resource.uid,
    orgId: resource.tenant,
    binding: {
      appItemId: resource.catalogItemId,
      appVersion: resource.version,
      appArtifactDigest: resource.artifactDigest ?? binding?.appArtifactDigest ?? "",
      specDigest: await specDigest(resource.spec, binding?.specDigest),
      desiredCommit: resource.commitSha ?? "",
      suiteGrantId: grantId.trim(),
      suiteDigest: suiteDigest.trim(),
      profile,
      parameterContract: parameterContract.trim(),
    },
    triggers: {
      onRevisionChange: { enabled: revisionTrigger },
      onSync: { enabled: syncTrigger, mode: "observedSync" },
      manual: { enabled: manualTrigger },
      cron: {
        enabled: cronTrigger,
        scheduleSetId: current?.triggers.cron.scheduleSetId ?? "nightly",
        schedules: cronTrigger ? schedule.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
        timezone: current?.triggers.cron.timezone ?? "UTC",
      },
    },
    timeout,
    concurrency: { maxActive: Number(maxActive), maxPending: Number(maxPending), queuedRevisionPolicy: "latestOnly" },
    retention: {
      workflowTTLSeconds: Number(workflowTTL), resultDays: Number(resultDays),
      successfulHistory: current?.retention.successfulHistory ?? 3,
      failedHistory: current?.retention.failedHistory ?? 3,
    },
    notifications: {
      endpointIds: endpointIds.split(",").map((item) => item.trim()).filter(Boolean),
      events: current?.notifications?.events ?? ["failed", "blocked"],
    },
    addonAbsent: current?.addonAbsent ?? "block",
    failureAction,
  });

  const runPreview = async (): Promise<{ policy: VerificationPolicy; preview: VerificationPolicyPreview } | null> => {
    setBusy(true); setError(null);
    try {
      const policy = await buildPolicy();
      const result = await previewInstanceVerification(token, resource.tenant, resource.id, policy);
      setPreview(result);
      return { policy, preview: result };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification preview failed");
      return null;
    } finally { setBusy(false); }
  };

  const save = async () => {
    const result = await runPreview();
    if (!result) return;
    setBusy(true);
    try {
      await saveInstanceVerification(token, resource.tenant, resource.id, result.policy);
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Verification policy save failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" aria-label="Verification policy editor">
      <div className="grid gap-4 md:grid-cols-2">
        <Input id="verification-grant" label="Platform suite grant ID" value={grantId} onChange={setGrantId} placeholder="vsg-…" />
        <Input id="verification-suite" label="Exact suite digest" value={suiteDigest} onChange={setSuiteDigest} placeholder="sha256:…" />
        <div className="form-group"><label className="form-label" htmlFor="verification-profile">Approved profile</label>
          <select id="verification-profile" className="select-native" value={profile} onChange={(event) => setProfile(event.target.value)}>
            <option value="stage">stage</option><option value="prod">prod</option><option value="ci">ci (preview/CI only)</option>
          </select>
        </div>
        <Input id="verification-contract" label="Parameter contract" value={parameterContract} onChange={setParameterContract} />
        <Input id="verification-timeout" label="Timeout" value={timeout} onChange={setTimeout} />
        <Input id="verification-schedule" label="Cron schedules (comma separated)" value={schedule} onChange={setSchedule} />
      </div>
      <fieldset className="space-y-2"><legend className="form-label">Triggers</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={revisionTrigger} onChange={(event) => setRevisionTrigger(event.target.checked)} /> On revision change</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={syncTrigger} onChange={(event) => setSyncTrigger(event.target.checked)} /> On observed sync</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={manualTrigger} onChange={(event) => setManualTrigger(event.target.checked)} /> Manual</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={cronTrigger} onChange={(event) => setCronTrigger(event.target.checked)} /> Cron</label>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-4">
        <Input id="verification-active" label="Max active" value={maxActive} onChange={setMaxActive} />
        <Input id="verification-pending" label="Max pending" value={maxPending} onChange={setMaxPending} />
        <Input id="verification-ttl" label="Workflow TTL (seconds)" value={workflowTTL} onChange={setWorkflowTTL} />
        <Input id="verification-retention" label="Result retention (days)" value={resultDays} onChange={setResultDays} />
      </div>
      <Input id="verification-endpoints" label="Existing notification endpoint IDs" value={endpointIds} onChange={setEndpointIds} />
      <div className="form-group"><label className="form-label" htmlFor="verification-failure">Failure action</label>
        <select id="verification-failure" className="select-native" value={failureAction} onChange={(event) => setFailureAction(event.target.value)}>
          <option value="notify">Notify</option><option value="pausePromotion">Pause promotion</option><option value="blockPromotion">Block promotion</option>
        </select>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {preview && <Alert variant="info">Preview completed with zero side effects. Rendering remains unavailable until the external gate opens. No automatic rollback is enabled.</Alert>}
      <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={runPreview}>Preview policy</Button>
        <Button variant="glow-accent" disabled={busy} onClick={save}>Preview and save</Button></div>
    </div>
  );
}
