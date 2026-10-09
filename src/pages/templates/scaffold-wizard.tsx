import * as React from "react";
import { Stepper } from "@/components/stepper";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import { listGitConnections } from "@/api/git-connections";
import {
  cancelScaffoldRun,
  createScaffoldRun,
  getScaffoldRun,
  getTemplate,
  retryScaffoldRun,
  type ScaffoldRunViewModel,
} from "@/api/templates";
import { useAuth } from "@/auth/auth-context";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { FallbackBlockedError } from "@/components/templates/fallback-blocked-error";
import {
  RunIdentityBadge,
  RunIdentityNotice,
} from "@/components/templates/run-identity-notice";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const STEPS = ["Configure", "Review", "Status"] as const;

// Scaffolding wizard (§7.3 #5): binds the tenant context (namespace, owning
// group, RBAC) into every scaffold; the server creates repo + pipeline +
// catalog entry in one run.


function StepList({ run }: { run: ScaffoldRunViewModel }) {
  if (run.steps.length === 0) return null;
  return (
    <ul className="w-full max-w-md space-y-1 text-left text-sm" aria-label="Scaffold steps">
      {run.steps.map((step) => (
        <li key={step.name} className="flex items-center gap-2">
          {step.state === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
          ) : step.state === "failed" ? (
            <XCircle className="h-4 w-4 u-danger" aria-hidden />
          ) : step.state === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin u-brand" aria-hidden />
          ) : (
            <Circle className="h-4 w-4 u-muted" aria-hidden />
          )}
          <span className="flex-1">{step.name}</span>
          <span className="text-xs u-muted">{step.state}</span>
        </li>
      ))}
    </ul>
  );
}

function ScaffoldStatus({ scaffoldId }: { scaffoldId: string }) {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const [stopped, setStopped] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);
  const { data: run, refetch } = useAsyncResource(
    (t) => getScaffoldRun(t, tenant, scaffoldId),
    [scaffoldId, tenant],
    { refetchIntervalMs: 1_000, enabled: !stopped },
  );
  React.useEffect(() => {
    if (run?.terminal) setStopped(true);
  }, [run]);

  if (!run) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm u-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Starting scaffold…
      </div>
    );
  }

  const cancel = async () => {
    setActing(true);
    setActionError(null);
    try {
      await cancelScaffoldRun(token, tenant, scaffoldId);
      setStopped(false);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to cancel the scaffold run",
      );
    } finally {
      setActing(false);
    }
  };

  const retry = async () => {
    setActing(true);
    setActionError(null);
    try {
      await retryScaffoldRun(token, tenant, scaffoldId);
      setStopped(false);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to retry the scaffold run",
      );
    } finally {
      setActing(false);
    }
  };

  if (run.failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="font-medium u-danger">Scaffold failed</p>
        <RunIdentityBadge run={run} />
        {(run.error ?? run.steps.find((s) => s.error)?.error) && (
          <p className="text-sm u-muted">
            {run.error ?? run.steps.find((s) => s.error)?.error}
          </p>
        )}
        <StepList run={run} />
        {actionError && (
          <p className="text-sm u-danger" role="alert">
            {actionError}
          </p>
        )}
        <Button onClick={retry} disabled={acting} size="sm">
          {acting ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  const terminal = run.phase === "completed";
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {terminal ? (
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
      ) : run.phase === "cancelled" ? (
        <XCircle className="h-10 w-10 u-muted" aria-hidden />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin u-brand" aria-hidden />
      )}
      <p className="font-medium">
        {terminal
          ? "Scaffold complete"
          : run.phase === "cancelled"
            ? "Scaffold cancelled"
            : `Scaffolding — ${run.phase}`}
      </p>
      <Badge variant={terminal ? "success" : "warning"}>{run.phase}</Badge>
      <RunIdentityBadge run={run} />
      <StepList run={run} />
      {actionError && (
        <p className="text-sm u-danger" role="alert">
          {actionError}
        </p>
      )}
      {!run.terminal && (
        <Button variant="secondary" size="sm" onClick={cancel} disabled={acting}>
          {acting ? "Cancelling…" : "Cancel run"}
        </Button>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {run.outputs.repoUrl && (
          <a href={run.outputs.repoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              Open repository
            </a>
        )}
        {run.outputs.pipelineUrl && (
          <a href={run.outputs.pipelineUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              Open pipeline
            </a>
        )}
        {run.outputs.catalogItemId && (
          <Link to={tenantLink(tenant, `catalog/${run.outputs.catalogItemId}`)} className="btn btn-primary btn-sm">
              View catalog entry
            </Link>
        )}
      </div>
    </div>
  );
}

export function ScaffoldWizardPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { templateId } = useParams<{ templateId: string }>();

  const template = useAsyncResource(
    (t) => getTemplate(t, tenant, templateId!),
    [templateId, tenant],
  );

  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [fallbackBlock, setFallbackBlock] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [run, setRun] = React.useState<ScaffoldRunViewModel | null>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const formRef = React.useRef<SchemaFormHandle>(null);

  const isUserScope = template.data?.scope === "user";
  const gitConnections = useAsyncResource(
    (t) => listGitConnections(t, tenant),
    [tenant],
    { enabled: isUserScope },
  );

  if (template.error) {
    return (
      <Card>
        <div className="card-body">
          Failed to load template: {template.error.message}
        </div>
      </Card>
    );
  }
  if (!template.data) {
    return <p className="text-sm u-muted">Loading template…</p>;
  }
  const tpl = template.data;

  const next = () => {
    if (!name) {
      setNameError("Service name is required.");
      return;
    }
    if (!NAME_PATTERN.test(name)) {
      setNameError("Use lowercase letters, numbers, and dashes (e.g. payments-api).");
      return;
    }
    setNameError(null);
    if (!formRef.current?.validate()) return;
    setStep(1);
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setFallbackBlock(null);
    try {
      const created = await createScaffoldRun(token, tenant, tpl.name, {
        displayName: name,
        values: formData,
      });
      setRun(created);
      setStep(2);
    } catch (err) {
      // 409 = fallback-block: the template needs a personal git connection
      // and the tenant fallback policy blocks the platform App identity.
      if (err instanceof ApiError && err.status === 409) {
        setFallbackBlock(err.message);
      } else {
        setSubmitError(
          err instanceof ApiError ? err.message : "Failed to start the scaffold",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-header-title">Scaffold {tpl.displayName}</h1>
        <p className="text-sm u-muted">
          Template v{tpl.version} · creates repo, pipeline, and catalog entry
        </p>
      </div>
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Configure</h2>
            <p className="card-lede">
              The tenant context is bound automatically: namespace, owning group, and RBAC
              are derived from the current tenant.
            </p>
          </div>
          <div className="card-body">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md u-raised p-3 text-sm">
              <dt className="u-muted">Tenant</dt>
              <dd className="font-mono text-xs">{tenant}</dd>
              <dt className="u-muted">Namespace</dt>
              <dd className="font-mono text-xs">{tenant}</dd>
              <dt className="u-muted">RBAC group</dt>
              <dd className="font-mono text-xs">tenant-{tenant}</dd>
            </dl>
            <RunIdentityNotice
              scope={tpl.scope}
              connections={gitConnections.data?.connections}
              tenant={tenant}
            />
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="service-name">Service name</label>
              <Input
                id="service-name"
                value={name}
                onChange={(v) => setName(v)}
                placeholder="payments-api"
              />
              {nameError && <p className="text-xs u-danger">{nameError}</p>}
            </div>
            <SchemaForm
              ref={formRef}
              schema={tpl.schema}
              uiSchema={tpl.uiSchema}
              formData={formData}
              onChange={setFormData}
            />
            <div className="flex justify-end gap-2">
              <Link to={tenantLink(tenant, "templates")} className="btn btn-ghost">
                Cancel
              </Link>
              <Button onClick={next}>Next</Button>
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Review</h2>
            <p className="card-lede">
              The scaffold run creates the repository, CI pipeline, and a discovered catalog
              entry, then binds tenant RBAC.
            </p>
          </div>
          <div className="card-body">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="u-muted">Name</dt>
              <dd>{name}</dd>
              <dt className="u-muted">Template</dt>
              <dd>{tpl.displayName}</dd>
              <dt className="u-muted">Tenant</dt>
              <dd>{tenant}</dd>
              <dt className="u-muted">Namespace</dt>
              <dd>{tenant}</dd>
            </dl>
            <RunIdentityNotice
              scope={tpl.scope}
              connections={gitConnections.data?.connections}
              tenant={tenant}
            />
            <pre className="max-h-72 overflow-auto rounded-md u-raised p-3 font-mono text-xs">
              {JSON.stringify(formData, null, 2)}
            </pre>
            {fallbackBlock !== null && (
              <FallbackBlockedError tenant={tenant} detail={fallbackBlock} />
            )}
            {submitError && (
              <p className="text-sm u-danger" role="alert">
                {submitError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Starting…" : "Scaffold"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && run && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Scaffold status</h2>
            <p className="card-lede">
              Repo, pipeline, and catalog entry are created by the scaffold run.
            </p>
          </div>
          <div className="card-body">
            <ScaffoldStatus scaffoldId={run.id} />
          </div>
        </Card>
      )}
    </div>
  );
}
