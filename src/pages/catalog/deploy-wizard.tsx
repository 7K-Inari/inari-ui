import * as React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";

import { getCatalogItem } from "@/api/catalog";
import { listClusters } from "@/api/clusters";
import { ApiError } from "@/api/client";
import { createDeploy, getDeploy } from "@/api/deploys";
import { useAsyncResource } from "@/api/hooks";
import type { Deploy } from "@/api/types";
import { useAuth } from "@/auth/auth-context";
import { PolicyDenialNotice } from "@/components/policy-denial";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { applyPolicy, injectLockedValues } from "@/components/schema-form/policy";
import { applyHintsToSchema, hintsToUiSchema } from "@/components/schema-form/ui-hints";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const STEPS = ["Configure", "Review", "Status"] as const;

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

function DeployStatus({ deployId }: { deployId: string }) {
  const [stopped, setStopped] = React.useState(false);
  const { data: deploy } = useAsyncResource((token) => getDeploy(token, deployId), [deployId], {
    refetchIntervalMs: 1_500,
    enabled: !stopped,
  });
  React.useEffect(() => {
    if (deploy?.phase === "healthy" || deploy?.phase === "failed") setStopped(true);
  }, [deploy]);

  if (!deploy) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Starting deploy…
      </div>
    );
  }

  if (deploy.phase === "failed") {
    return (
      <div className="py-6 text-center">
        <p className="font-medium text-destructive">Deploy failed</p>
        {deploy.message && (
          <p className="text-sm text-muted-foreground">{deploy.message}</p>
        )}
      </div>
    );
  }

  const terminal = deploy.phase === "healthy";
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {terminal ? (
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      )}
      <p className="font-medium">
        {terminal ? "Deploy healthy" : `Deploy in progress — ${deploy.phase}`}
      </p>
      <div className="flex gap-2">
        <Badge variant={terminal ? "success" : "warning"}>{deploy.phase}</Badge>
        <Badge variant="muted">
          {deploy.gitopsMode === "pull-request" ? "pull request" : "direct commit"}
        </Badge>
      </div>
      <div className="flex gap-2">
        {deploy.prUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={deploy.prUrl} target="_blank" rel="noreferrer">
              Open pull request
            </a>
          </Button>
        )}
        {deploy.instanceId && (
          <Button asChild size="sm">
            <InstanceLink deploy={deploy} />
          </Button>
        )}
      </div>
    </div>
  );
}

function InstanceLink({ deploy }: { deploy: Deploy }) {
  const { tenant } = useTenant();
  return <Link to={tenantLink(tenant, `deploys/${deploy.instanceId}`)}>View resource instance</Link>;
}

export function DeployWizardPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { itemId } = useParams<{ itemId: string }>();
  const [searchParams] = useSearchParams();
  const version = searchParams.get("version") ?? "";

  const item = useAsyncResource((token) => getCatalogItem(token, itemId!), [itemId]);
  const clusters = useAsyncResource((token) => listClusters(token, tenant), [tenant]);

  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [clusterId, setClusterId] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [policyDenial, setPolicyDenial] = React.useState<{
    reason: string;
    remediation?: string;
  } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deployId, setDeployId] = React.useState<string | null>(null);
  const formRef = React.useRef<SchemaFormHandle>(null);

  const policy = item.data?.policy;
  const policyApp = React.useMemo(
    () => (item.data ? applyPolicy(item.data.schema, item.data.policy) : null),
    [item.data],
  );
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});

  React.useEffect(() => {
    if (policyApp) {
      setFormData((prev) => ({ ...policyApp.formDefaults, ...prev }));
    }
  }, [policyApp]);

  const schema = React.useMemo(
    () => (item.data ? applyHintsToSchema(item.data.schema, item.data.uiHints) : null),
    [item.data],
  );
  const uiSchema = React.useMemo(() => {
    if (!item.data || !policyApp) return {};
    return { ...hintsToUiSchema(item.data.uiHints), ...policyApp.uiSchema };
  }, [item.data, policyApp]);

  if (item.error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive">
          Failed to load catalog item: {item.error.message}
        </CardContent>
      </Card>
    );
  }
  if (!item.data || !schema || !policy) {
    return <p className="text-sm text-muted-foreground">Loading deploy wizard…</p>;
  }
  const itemData = item.data;

  const pinned = version || itemData.latestVersion;

  const next = () => {
    if (!name) {
      setNameError("Instance name is required.");
      return;
    }
    if (!NAME_PATTERN.test(name)) {
      setNameError("Use lowercase letters, numbers, and dashes (e.g. orders-db).");
      return;
    }
    setNameError(null);
    if (!clusterId) {
      setSubmitError("Select a target cluster.");
      return;
    }
    setSubmitError(null);
    if (!formRef.current?.validate()) {
      return;
    }
    setStep(1);
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setPolicyDenial(null);
    try {
      const deploy = await createDeploy(token, tenant, {
        itemId: itemData.id,
        version: pinned,
        clusterId,
        name,
        spec: injectLockedValues(formData, policy.lockedFields),
      });
      setDeployId(deploy.id);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.isPolicyDenial) {
        setPolicyDenial({ reason: err.message, remediation: err.remediation });
      } else {
        setSubmitError(err instanceof Error ? err.message : "Failed to create deploy");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reviewSpec = injectLockedValues(formData, policy.lockedFields);
  const clusterName =
    (clusters.data ?? []).find((c) => c.id === clusterId)?.name ?? clusterId;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Deploy {itemData.displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Version {pinned} · {policy.gitopsMode === "pull-request" ? "GitOps pull request" : "GitOps direct commit"}
        </p>
      </div>
      <StepIndicator current={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configure</CardTitle>
            <CardDescription>
              Fields marked as locked are pinned by platform policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="instance-name">Instance name</Label>
              <Input
                id="instance-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="orders-db"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-cluster">Target cluster</Label>
              <select
                id="target-cluster"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={clusterId}
                onChange={(e) => setClusterId(e.target.value)}
              >
                <option value="">Select a cluster…</option>
                {(clusters.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <SchemaForm
              ref={formRef}
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              onChange={setFormData}
            />
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" asChild>
                <Link to={tenantLink(tenant, `catalog/${itemData.id}`)}>Cancel</Link>
              </Button>
              <Button onClick={next}>Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>
              Confirm the desired state. The orchestrator renders this to tenant Git.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{name}</dd>
              <dt className="text-muted-foreground">Catalog item</dt>
              <dd>{itemData.displayName}</dd>
              <dt className="text-muted-foreground">Version</dt>
              <dd>{pinned}</dd>
              <dt className="text-muted-foreground">Target cluster</dt>
              <dd>{clusterName}</dd>
              <dt className="text-muted-foreground">GitOps mode</dt>
              <dd>{policy.gitopsMode === "pull-request" ? "pull request" : "direct commit"}</dd>
            </dl>
            {policy.approvalRequired && (
              <Badge variant="warning">This deploy requires approval before it is applied</Badge>
            )}
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {JSON.stringify(reviewSpec, null, 2)}
            </pre>
            {policyDenial && (
              <PolicyDenialNotice
                reason={policyDenial.reason}
                remediation={policyDenial.remediation}
              />
            )}
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Deploy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && deployId && (
        <Card>
          <CardHeader>
            <CardTitle>Deploy status</CardTitle>
            <CardDescription>Live status reported back from the tenant cluster.</CardDescription>
          </CardHeader>
          <CardContent>
            <DeployStatus deployId={deployId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
