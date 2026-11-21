import * as React from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Input, Select } from "7k-design-system/react";
import { listCatalogItems } from "@/api/catalog";
import { preflightDeploymentPlan, submitDeploymentPlan, type DeploymentPlan, type DeploymentPreflight, type DeploymentPlanRequest } from "@/api/deployment-plans";
import { useAsyncResource } from "@/api/hooks";
import { listTeams } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { PageHeader } from "@/components/page-header";
import { Stepper } from "@/components/stepper";
import { ObservabilityPlanSection } from "@/components/observability/plan-section";
import { CompanionCard } from "@/components/observability/companion-card";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { applyHintsToSchema, hintsToUiSchema } from "@/components/schema-form/ui-hints";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import type { components } from "@/api/__generated__/schema";

const STEPS = ["Configure", "Review", "Status"] as const;
type ObservabilityInput = components["schemas"]["ObservabilityInput"];

export function DirectChartWizardPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());
  const catalog = useAsyncResource((token) => listCatalogItems(token, tenant, {}), [tenant]);
  const teams = useAsyncResource((token) => listTeams(token, tenant), [tenant]);
  const sourceIds = Array.from(new Set((catalog.data?.items ?? []).map((item) => item.sourceId).filter((id): id is string => !!id))).sort();
  const [sourceId, setSourceId] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [digest, setDigest] = React.useState("");
  const [admissionItemId, setAdmissionItemId] = React.useState("");
  const [admissionVersion, setAdmissionVersion] = React.useState("");
  const [name, setName] = React.useState("");
  const [namespace, setNamespace] = React.useState("default");
  const [ownerTeam, setOwnerTeam] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [observability, setObservability] = React.useState<ObservabilityInput>({ mode: "skip" });
  const [initial, setInitial] = React.useState<DeploymentPreflight | null>(null);
  const [review, setReview] = React.useState<DeploymentPreflight | null>(null);
  const [submitted, setSubmitted] = React.useState<DeploymentPlan | null>(null);
  const [step, setStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<SchemaFormHandle>(null);

  React.useEffect(() => { if (!sourceId && sourceIds.length === 1) setSourceId(sourceIds[0]); }, [sourceId, sourceIds]);

  const request = React.useCallback((deployment?: DeploymentPlanRequest["deployment"]): DeploymentPlanRequest => ({
    operation: "deploy",
    source: { kind: "chart", sourceId, ref, version, digest, ...(admissionItemId ? { admissionItemId, admissionVersion } : {}) },
    deployment: deployment ?? { targetId: "", targetRevision: 0, spec: {} },
    observability: { mode: "provision" }, idempotencyKey,
  }), [sourceId, ref, version, digest, admissionItemId, admissionVersion, idempotencyKey]);

  const preflight = async () => {
    setError(null);
    if (!sourceId || !ref || !version || !/^sha256:[0-9a-f]{64}$/.test(digest) || /:latest$/.test(ref)) {
      setError("Trusted source, OCI repository without a tag, exact version, and all 64 digest hex characters are required; latest is invalid.");
      return;
    }
    setLoading(true);
    try {
      const result = await preflightDeploymentPlan(token, tenant, request());
      setInitial(result);
      setObservability(result.plan.capability ? { mode: "skip" } : { mode: "none" });
    } catch (err) { setError(err instanceof Error ? err.message : "Observability preflight unavailable"); }
    finally { setLoading(false); }
  };

  const next = async () => {
    if (!initial) return;
    setError(null);
    if (!name || !targetId) { setError("Instance name and target cluster are required."); return; }
    if (observability.mode === "provision" && !ownerTeam) { setError("Select an owning team for folder access."); return; }
    if (!formRef.current?.validate()) return;
    setLoading(true);
    try {
      const target = initial.deploymentTargets?.find((candidate) => candidate.id === targetId);
      const result = await preflightDeploymentPlan(token, tenant, { ...request({ targetId, targetRevision: target?.revision ?? 0, name, namespace, ownerTeam, spec: formData }), observability });
      setReview(result);
      setStep(1);
    } catch (err) { setError(err instanceof Error ? err.message : "Observability preflight unavailable"); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (!review) return;
    setLoading(true);
    setError(null);
    try {
      const plan = await submitDeploymentPlan(token, tenant, { operation: "deploy", source: review.plan.source, deployment: review.plan.deployment, observability: review.plan.observability, planFingerprint: review.plan.planFingerprint, idempotencyKey });
      setSubmitted(plan);
      setStep(2);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create deploy"); }
    finally { setLoading(false); }
  };

  const schema = applyHintsToSchema((review?.schema ?? initial?.schema ?? {}) as Record<string, unknown>, (review?.uiHints ?? initial?.uiHints ?? {}) as never);
  const uiSchema = hintsToUiSchema((review?.uiHints ?? initial?.uiHints ?? {}) as never);
  return <div className="wizard mx-auto max-w-[800px]">
    <PageHeader breadcrumb="Deliver / Catalog / Direct OCI chart" title="Deploy OCI chart" lede="Trusted-source admission requires an exact signed chart identity." />
    <Stepper steps={STEPS} current={step} />
    {error && <Alert variant="danger">{error}</Alert>}
    {step === 0 && <Card><div className="card-body wizard-body">
      <Alert variant="neutral">Publisher, provenance, policy, and admission identity are verified by the server from the trusted source. Arbitrary OCI charts are not admitted.</Alert>
      <div><label className="mb-1 block text-sm" htmlFor="chart-source">Trusted source</label><Select id="chart-source" value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Select a trusted source…</option>{sourceIds.map((id) => <option key={id} value={id}>{id}</option>)}</Select></div>
      <Input id="chart-repository" label="OCI repository (no tag)" value={ref} onChange={setRef} placeholder="oci://ghcr.io/7k-hiroba/payments-api/charts/payments-api" />
      <div className="grid gap-3 md:grid-cols-2"><Input id="chart-version" label="Exact chart version" value={version} onChange={setVersion} placeholder="1.4.0" /><Input id="chart-digest" label="SHA-256 digest" value={digest} onChange={setDigest} placeholder="sha256:…" /></div>
      <div className="grid gap-3 md:grid-cols-2"><Input id="chart-admission-item" label="Signed-index item (only if ambiguous)" value={admissionItemId} onChange={setAdmissionItemId} /><Input id="chart-admission-version" label="Signed-index version (only if ambiguous)" value={admissionVersion} onChange={setAdmissionVersion} /></div>
      {!initial && <Button variant="accent" onClick={preflight} disabled={loading}>{loading ? "Checking exact app metadata…" : "Check exact chart"}</Button>}
      {initial && <>
        <Input id="chart-instance-name" label="Instance name" value={name} onChange={setName} />
        <div><label className="mb-1 block text-sm" htmlFor="chart-target">Target cluster</label><Select id="chart-target" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Select a cluster…</option>{initial.deploymentTargets?.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</Select></div>
        {observability.mode === "provision" && <><Input id="chart-namespace" label="Namespace" value={namespace} onChange={setNamespace} /><div><label className="mb-1 block text-sm" htmlFor="chart-owner-team">Owning team for folder access</label><Select id="chart-owner-team" value={ownerTeam} onChange={(event) => setOwnerTeam(event.target.value)}><option value="">Select a team…</option>{teams.data?.map((team) => <option key={team.id} value={team.name}>{team.displayName}</option>)}</Select></div></>}
        <SchemaForm ref={formRef} schema={schema} uiSchema={uiSchema} formData={formData} onChange={setFormData} />
        <ObservabilityPlanSection preflight={initial} value={observability} onChange={setObservability} />
        <div className="wizard-actions"><Button variant="ghost" onClick={() => setInitial(null)}>Edit chart</Button><Button variant="accent" onClick={next} disabled={loading}>Next</Button></div>
      </>}
    </div></Card>}
    {step === 1 && review && <Card><div className="card-header"><h2 className="mono-label">Review</h2></div><div className="card-body wizard-body">
      <dl className="wizard-review"><dt>Chart</dt><dd className="break-all">{ref}</dd><dt>Version</dt><dd>{version}</dd><dt>Digest</dt><dd className="break-all">{digest}</dd><dt>Target revision</dt><dd>{review.plan.deployment.targetRevision}</dd><dt>Plan fingerprint</dt><dd className="break-all">{review.plan.planFingerprint}</dd></dl>
      <Badge variant="neutral">{review.plan.observability.mode}</Badge><pre className="code-block">{JSON.stringify(formData, null, 2)}</pre>
      <div className="wizard-actions"><Button variant="ghost" onClick={() => setStep(0)}>Back</Button><Button variant="glow-accent" onClick={submit} disabled={loading}>{loading ? "Submitting…" : review.plan.observability.mode === "provision" ? "Deploy with observability" : "Deploy application"}</Button></div>
    </div></Card>}
    {step === 2 && submitted && <Card><div className="card-header"><h2 className="mono-label">Deploy status</h2></div><div className="card-body space-y-4"><Badge variant="warning">{submitted.state}</Badge>{submitted.companion && <CompanionCard status={{ mode: submitted.observability.mode, available: !!submitted.capability, companion: submitted.companion }} />}{submitted.appInstanceId && <Link className="btn btn-accent" to={tenantLink(tenant, `deploys/${submitted.appInstanceId}`)}>View resource instance</Link>}</div></Card>}
  </div>;
}
