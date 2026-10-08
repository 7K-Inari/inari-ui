import * as React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { getCatalogItem } from "@/api/catalog";
import { listClusters } from "@/api/clusters";
import { ApiError } from "@/api/client";
import { createDeploy, getDeploy } from "@/api/deploys";
import { useAsyncResource } from "@/api/hooks";
import type { Deploy } from "@/api/types";
import { useAuth } from "@/auth/auth-context";
import { Alert, Badge, Button, Card, Input, Spinner } from "7k-design-system/react";

import { PageHeader } from "@/components/page-header";
import { PolicyDenialNotice } from "@/components/policy-denial";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { applyHintsToSchema, hintsToUiSchema } from "@/components/schema-form/ui-hints";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const STEPS = ["Configure", "Review", "Status"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label="Wizard progress">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={`step${i === current ? " active" : ""}${i < current ? " completed" : ""}`}
          aria-current={i === current ? "step" : undefined}
        >
          {label}
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
      <div className="wizard-status-pending">
        <Spinner size="sm" aria-hidden /> Starting deploy…
      </div>
    );
  }

  if (deploy.phase === "failed") {
    return (
      <Alert variant="danger">
        <span>
          Deploy failed{deploy.message ? ` — ${deploy.message}` : ""}
        </span>
      </Alert>
    );
  }

  const terminal = deploy.phase === "healthy";
  return (
    <div className="wizard-status">
      {terminal ? (
        <CheckCircle2 size={40} className="wizard-status-ok" aria-hidden />
      ) : (
        <Spinner size="lg" aria-hidden />
      )}
      <p className="wizard-status-title">
        {terminal ? "Deploy healthy" : `Deploy in progress — ${deploy.phase}`}
      </p>
      <div className="wizard-status-badges">
        <Badge variant={terminal ? "success" : "warning"}>{deploy.phase}</Badge>
        <span className="tag">
          {deploy.gitopsMode === "pull-request" ? "pull request" : "direct commit"}
        </span>
      </div>
      <div className="wizard-status-actions">
        {deploy.prUrl && (
          <a href={deploy.prUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            Open pull request
          </a>
        )}
        {deploy.instanceId && (
          <span className="btn btn-accent btn-sm">
            <InstanceLink deploy={deploy} />
          </span>
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

  const [formData, setFormData] = React.useState<Record<string, unknown>>({});

  const schema = React.useMemo(
    () => (item.data ? applyHintsToSchema(item.data.schema, item.data.uiHints) : null),
    [item.data],
  );
  const uiSchema = React.useMemo(
    () => (item.data ? hintsToUiSchema(item.data.uiHints) : {}),
    [item.data],
  );

  if (item.error) {
    return <Alert variant="danger">Failed to load catalog item: {item.error.message}</Alert>;
  }
  if (!item.data || !schema) {
    return (
      <div className="overview-card-skeleton" aria-busy="true">
        <Spinner size="md" />
      </div>
    );
  }
  const itemData = item.data;

  const pinned = version || itemData.latestVersion || "";

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
        spec: formData,
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

  const reviewSpec = formData;
  const clusterName =
    (clusters.data ?? []).find((c) => c.id === clusterId)?.name ?? clusterId;

  return (
    <div className="wizard">
      <PageHeader
        breadcrumb="Deliver / Catalog / Deploy"
        title={`Deploy ${itemData.displayName}`}
        lede={`Version ${pinned}`}
      />
      <StepIndicator current={step} />

      {step === 0 && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Configure</h2>
          </div>
          <div className="card-body wizard-body">
            <Input
              id="instance-name"
              label="Instance name"
              value={name}
              onChange={(value) => setName(value)}
              placeholder="orders-db"
              error={nameError ?? undefined}
            />
            <div className="form-group">
              <label htmlFor="target-cluster" className="form-label">
                Target cluster
              </label>
              <select
                id="target-cluster"
                className="select-native"
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
            {submitError && <Alert variant="danger">{submitError}</Alert>}
            <div className="wizard-actions">
              <Link to={tenantLink(tenant, `catalog/${itemData.id}`)} className="btn btn-ghost">
                Cancel
              </Link>
              <Button variant="accent" onClick={next}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Review</h2>
          </div>
          <div className="card-body wizard-body">
            <dl className="wizard-review">
              <dt>Name</dt>
              <dd>{name}</dd>
              <dt>Catalog item</dt>
              <dd>{itemData.displayName}</dd>
              <dt>Version</dt>
              <dd>{pinned}</dd>
              <dt>Target cluster</dt>
              <dd>{clusterName}</dd>
            </dl>
            {itemData.approvalPolicy !== "auto" && (
              <Alert variant="info">This deploy requires approval before it is applied</Alert>
            )}
            <pre className="code-block">{JSON.stringify(reviewSpec, null, 2)}</pre>
            {policyDenial && (
              <PolicyDenialNotice
                reason={policyDenial.reason}
                remediation={policyDenial.remediation}
              />
            )}
            {submitError && <Alert variant="danger">{submitError}</Alert>}
            <div className="wizard-actions">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button variant="glow-accent" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Deploy"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && deployId && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Deploy status</h2>
          </div>
          <div className="card-body">
            <DeployStatus deployId={deployId} />
          </div>
        </Card>
      )}
    </div>
  );
}
