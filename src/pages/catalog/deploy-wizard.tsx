import * as React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { getCatalogItem } from "@/api/catalog";
import { itemRouteID } from "@/api/identity";
import { ApiError } from "@/api/client";
import { getDeploy } from "@/api/deploys";
import type { Deploy } from "@/api/types";
import {
  getDeploymentPlan,
  preflightDeploymentPlan,
  submitDeploymentPlan,
  type DeploymentPlan,
  type DeploymentPlanRequest,
  type DeploymentPreflight,
} from "@/api/deployment-plans";
import { listGitRepos } from "@/api/git-repos";
import { useAsyncResource } from "@/api/hooks";
import { listTeams } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { Alert, Badge, Button, Card, Input, Spinner } from "7k-design-system/react";

import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/catalog/source-badge";
import { Stepper } from "@/components/stepper";
import { PolicyDenialNotice } from "@/components/policy-denial";
import { ActionErrorNotice } from "@/components/limit-exceeded";
import { CompanionCard } from "@/components/observability/companion-card";
import { ObservabilityPlanSection } from "@/components/observability/plan-section";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { applyHintsToSchema, hintsToUiSchema } from "@/components/schema-form/ui-hints";
import { RepoPicker } from "@/pages/settings/org/git/repo-picker";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import type { components } from "@/api/__generated__/schema";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const STEPS = ["Configure", "Review", "Status"] as const;
type ObservabilityInput = components["schemas"]["ObservabilityInput"];

function PlanStatus({ planId }: { planId: string }) {
  const { tenant } = useTenant();
  const { data: plan } = useAsyncResource((token) => getDeploymentPlan(token, tenant, planId), [planId, tenant], { refetchIntervalMs: 1_500 });
  const appInstanceId = plan?.appInstanceId;
  const { data: appDeploy } = useAsyncResource((token) => getDeploy(token, appInstanceId!, tenant), [appInstanceId, tenant], { enabled: !!appInstanceId, refetchIntervalMs: 1_500 });
  if (!plan) return <div className="wizard-status-pending" aria-busy="true"><Spinner size="sm" aria-hidden /> Checking plan status…</div>;
  return <PlanStatusView plan={plan} appDeploy={appDeploy} />;
}

function PlanStatusView({ plan, appDeploy }: { plan: DeploymentPlan; appDeploy?: Deploy | null }) {
  const { tenant } = useTenant();
  return (
    <div className="wizard-status space-y-4">
      <div><CheckCircle2 size={40} className="wizard-status-ok" aria-hidden /><p className="wizard-status-title">{appDeploy?.phase === "healthy" ? "Deploy healthy" : `Plan ${plan.state}`}</p></div>
      <div className="wizard-status-badges"><Badge variant={appDeploy?.phase === "healthy" ? "success" : "warning"}>{appDeploy?.phase ?? plan.state}</Badge><Badge variant="neutral">{plan.app.version}</Badge></div>
      {appDeploy?.prUrl && <a href={appDeploy.prUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Open pull request</a>}
      <div className="text-left">{plan.companion && <CompanionCard status={{ mode: plan.observability.mode, available: !!plan.capability, companion: plan.companion }} />}</div>
      {(appDeploy?.instanceId ?? plan.appInstanceId) && <Link className="btn btn-accent btn-sm" to={tenantLink(tenant, `deploys/${appDeploy?.instanceId ?? plan.appInstanceId}`)}>View resource instance</Link>}
    </div>
  );
}

export function DeployWizardPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { itemId: legacyItemId, source, name: routeName } = useParams<{ itemId?: string; source?: string; name?: string }>();
  const itemId = itemRouteID({ itemId: legacyItemId, source, name: routeName });
  const [searchParams] = useSearchParams();
  const version = searchParams.get("version") ?? "";
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());

  const item = useAsyncResource((token) => getCatalogItem(token, itemId!), [itemId]);
  const repos = useAsyncResource((token) => listGitRepos(token, tenant), [tenant]);
  const teams = useAsyncResource((token) => listTeams(token, tenant), [tenant]);
  const initialRequest = React.useCallback((): DeploymentPlanRequest => ({
    operation: "deploy",
    source: { kind: "catalog", itemId: itemId!, ...(version ? { version } : {}) },
    deployment: { targetId: "", targetRevision: 0, spec: {} },
    observability: { mode: "provision" }, idempotencyKey,
  }), [itemId, version, idempotencyKey]);
  const initialPreflight = useAsyncResource((token) => preflightDeploymentPlan(token, tenant, initialRequest()), [tenant, initialRequest]);

  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [namespace, setNamespace] = React.useState("default");
  const [ownerTeam, setOwnerTeam] = React.useState("");
  const [repoId, setRepoId] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<unknown>(null);
  const [policyDenial, setPolicyDenial] = React.useState<{ reason: string; remediation?: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [planId, setPlanId] = React.useState<string | null>(null);
  const [observability, setObservability] = React.useState<ObservabilityInput>({ mode: "skip" });
  const [reviewPreflight, setReviewPreflight] = React.useState<DeploymentPreflight | null>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const formRef = React.useRef<SchemaFormHandle>(null);

  React.useEffect(() => {
    if (repos.data && !repoId) {
      const def = repos.data.find((r) => r.isDefault);
      if (def) setRepoId(def.id);
    }
  }, [repos.data, repoId]);

  const itemData = item.data;
  const selectedVersion = itemData?.versions.find((v) => v.version === (version || itemData.latestVersion || ""));
  const schemaSource = reviewPreflight?.schema ?? initialPreflight.data?.schema ?? itemData?.schema ?? {};
  const hintsSource = reviewPreflight?.uiHints ?? initialPreflight.data?.uiHints ?? itemData?.uiHints ?? {};
  const schema = React.useMemo(() => applyHintsToSchema(schemaSource as Record<string, unknown>, hintsSource as never), [schemaSource, hintsSource]);
  const uiSchema = React.useMemo(() => hintsToUiSchema(hintsSource as never), [hintsSource]);

  if (item.error) return <Alert variant="danger">Failed to load catalog item: {item.error.message}</Alert>;
  if (!itemData || !schema) return <div className="overview-card-skeleton" aria-busy="true"><Spinner size="md" /></div>;
  const pinned = version || itemData.latestVersion || "";

  const next = async () => {
    if (!name) { setNameError("Instance name is required."); return; }
    if (!NAME_PATTERN.test(name)) { setNameError("Use lowercase letters, numbers, and dashes (e.g. orders-db)."); return; }
    if (!targetId) { setSubmitError("Select a target cluster."); return; }
    if (!formRef.current?.validate()) return;
    setNameError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const target = initialPreflight.data?.deploymentTargets?.find((candidate) => candidate.resourceRef.id === targetId);
      const preflight = await preflightDeploymentPlan(token, tenant, {
        ...initialRequest(),
        deployment: { targetId: target?.id ?? "", targetRevision: target?.revision ?? 0, repoId: repoId || undefined, name, namespace, ownerTeam, spec: formData },
        observability,
      });
      setReviewPreflight(preflight);
      setStep(1);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!reviewPreflight) return;
    setSubmitting(true);
    setSubmitError(null);
    setPolicyDenial(null);
    try {
      const plan = await submitDeploymentPlan(token, tenant, {
        operation: "deploy", source: reviewPreflight.plan.source, deployment: reviewPreflight.plan.deployment,
        observability: reviewPreflight.plan.observability, planFingerprint: reviewPreflight.plan.planFingerprint, idempotencyKey,
      });
      setPlanId(plan.id);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.isPolicyDenial) setPolicyDenial({ reason: err.message, remediation: err.remediation });
      else setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const targetName = initialPreflight.data?.deploymentTargets?.find((target) => target.resourceRef.id === targetId)?.name ?? targetId;
  return (
    <div className="wizard">
      <PageHeader breadcrumb="Deliver / Catalog / Deploy" title={`Deploy ${itemData.displayName}`} lede={`Version ${pinned}`} />
      <Stepper steps={STEPS} current={step} />
      <div className="mb-4"><SourceBadge source={itemData.source} sourceId={itemData.sourceId} trustTier={itemData.trustTier} unsigned={itemData.unsigned} />{selectedVersion?.artifactDigest && <p className="mono-caption mt-1 break-all">Digest: {selectedVersion.artifactDigest}</p>}</div>

      {step === 0 && <Card><div className="card-header"><h2 className="mono-label">Configure</h2></div><div className="card-body wizard-body">
        <Input id="instance-name" label="Instance name" value={name} onChange={setName} placeholder="orders-db" error={nameError ?? undefined} />
        <div className="form-group"><label htmlFor="target-cluster" className="form-label">Target cluster</label><select id="target-cluster" className="select-native" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Select a cluster…</option>{initialPreflight.data?.deploymentTargets?.map((target) => <option key={target.id} value={target.resourceRef.id}>{target.name}</option>)}</select></div>
        {observability.mode === "provision" && <><Input id="instance-namespace" label="Namespace" value={namespace} onChange={setNamespace} /><div className="form-group"><label htmlFor="owner-team" className="form-label">Owning team for folder access</label><select id="owner-team" className="select-native" value={ownerTeam} onChange={(event) => setOwnerTeam(event.target.value)}><option value="">Select a team…</option>{teams.data?.map((team) => <option key={team.id} value={team.name}>{team.displayName}</option>)}</select></div></>}
        {repos.data && repos.data.length > 0 && <RepoPicker repos={repos.data} teams={(teams.data ?? []).map((t) => ({ id: t.id, displayName: t.displayName }))} selectedId={repoId} onSelect={setRepoId} />}
        <SchemaForm ref={formRef} schema={schema} uiSchema={uiSchema} formData={formData} onChange={setFormData} />
        {initialPreflight.data && <ObservabilityPlanSection preflight={initialPreflight.data} value={observability} onChange={setObservability} loading={initialPreflight.loading} error={initialPreflight.error?.message} />}
        {submitError != null && <ActionErrorNotice error={submitError} fallback="Observability preflight unavailable" />}
        <div className="wizard-actions"><Link to={tenantLink(tenant, `catalog/${itemData.id}`)} className="btn btn-ghost">Cancel</Link><Button variant="accent" onClick={next} disabled={submitting}>{submitting ? "Checking exact app metadata…" : "Next"}</Button></div>
      </div></Card>}

      {step === 1 && reviewPreflight && <Card><div className="card-header"><h2 className="mono-label">Review</h2></div><div className="card-body wizard-body">
        <dl className="wizard-review"><dt>Name</dt><dd>{name}</dd><dt>Catalog item</dt><dd>{itemData.displayName}</dd><dt>Version</dt><dd>{reviewPreflight.plan.app.version}</dd>{selectedVersion?.packageVersion && <><dt>Package version</dt><dd>{selectedVersion.packageVersion}</dd></>}{itemData.sourceState && <><dt>Source health</dt><dd>{itemData.sourceState === "stale" ? "Stale source" : itemData.sourceState}</dd></>}<dt>Target cluster</dt><dd>{targetName}</dd><dt>Target revision</dt><dd>{reviewPreflight.plan.deployment.targetRevision}</dd><dt>Plan fingerprint</dt><dd className="break-all">{reviewPreflight.plan.planFingerprint}</dd></dl>
        {itemData.approvalPolicy !== "auto" && <Alert variant="info">This application deploy requires approval before it is applied.</Alert>}
        {reviewPreflight.plan.observability.mode === "provision" && <Alert variant="info">Companion approval is independent of application approval.</Alert>}
        <pre className="code-block">{JSON.stringify(formData, null, 2)}</pre>
        {policyDenial && <PolicyDenialNotice reason={policyDenial.reason} remediation={policyDenial.remediation} />}
        {submitError != null && <ActionErrorNotice error={submitError} fallback="Failed to create deploy" />}
        <div className="wizard-actions"><Button variant="ghost" onClick={() => setStep(0)}>Back</Button><Button variant="glow-accent" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : reviewPreflight.plan.observability.mode === "provision" ? "Deploy with observability" : "Deploy application"}</Button></div>
      </div></Card>}
      {step === 2 && planId && <Card><div className="card-header"><h2 className="mono-label">Deploy status</h2></div><div className="card-body"><PlanStatus planId={planId} /></div></Card>}
    </div>
  );
}
