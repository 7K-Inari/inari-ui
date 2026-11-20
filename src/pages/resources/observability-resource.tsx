import * as React from "react";
import { Alert, Button, Card } from "7k-design-system/react";
import { getInstanceObservability, preflightDeploymentPlan, submitDeploymentPlan, type DeploymentPreflight } from "@/api/deployment-plans";
import { useAsyncResource } from "@/api/hooks";
import { useTenant } from "@/tenant/tenant-context";
import { useAuth } from "@/auth/auth-context";
import { ObservabilityPlanSection } from "@/components/observability/plan-section";
import { CompanionCard } from "@/components/observability/companion-card";
import type { components } from "@/api/__generated__/schema";

type ObservabilityInput = components["schemas"]["ObservabilityInput"];

export function ObservabilityResource({ instanceId }: { instanceId: string }) {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());
  const status = useAsyncResource((token) => getInstanceObservability(token, tenant, instanceId), [tenant, instanceId]);
  const [preflight, setPreflight] = React.useState<DeploymentPreflight | null>(null);
  const [observability, setObservability] = React.useState<ObservabilityInput>({ mode: "provision" });
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const provision = async () => {
    setError(null);
    try {
      const result = await preflightDeploymentPlan(token, tenant, {
        operation: "provisionExisting", instanceId,
        deployment: { targetId: "", targetRevision: 0, spec: {} }, observability: { mode: "provision" }, idempotencyKey,
      });
      setPreflight(result);
      setObservability(result.plan.observability);
    } catch (err) { setError(err instanceof Error ? err.message : "Observability preflight unavailable"); }
  };
  const submit = async () => {
    if (!preflight) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitDeploymentPlan(token, tenant, {
        operation: "provisionExisting", instanceId, source: preflight.plan.source, deployment: preflight.plan.deployment,
        observability: preflight.plan.observability, planFingerprint: preflight.plan.planFingerprint, idempotencyKey,
      });
      setPreflight(null);
      status.refetch();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to provision observability"); }
    finally { setSubmitting(false); }
  };

  return <Card><div className="card-header"><h2 className="mono-label">Observability</h2><p className="card-lede">Target-side verification gates Grafana links; application health alone is insufficient.</p></div><div className="card-body space-y-4">
    {status.error && <Alert variant="danger">{status.error.message}</Alert>}
    {status.data && <CompanionCard status={status.data} onProvision={preflight ? undefined : provision} onRecheck={preflight ? undefined : provision} />}
    {preflight && <><ObservabilityPlanSection preflight={preflight} value={observability} onChange={setObservability} /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setPreflight(null)}>Cancel</Button><Button variant="glow-accent" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Deploy with observability"}</Button></div></>}
    {error && <Alert variant="danger">{error}</Alert>}
  </div></Card>;
}
