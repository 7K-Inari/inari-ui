import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  createScaffold,
  getScaffold,
  getTemplate,
  type ScaffoldRun,
} from "@/api/templates";
import { useAuth } from "@/auth/auth-context";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const STEPS = ["Configure", "Review", "Status"] as const;

// Scaffolding wizard (§7.3 #5): binds the tenant context (namespace, owning
// group, RBAC) into every scaffold; the server creates repo + pipeline +
// catalog entry in one run.

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

function ScaffoldStatus({ scaffoldId }: { scaffoldId: string }) {
  const { tenant } = useTenant();
  const [stopped, setStopped] = React.useState(false);
  const { data: run } = useAsyncResource(
    (token) => getScaffold(token, tenant, scaffoldId),
    [scaffoldId, tenant],
    { refetchIntervalMs: 1_000, enabled: !stopped },
  );
  React.useEffect(() => {
    if (run?.phase === "completed" || run?.phase === "failed") setStopped(true);
  }, [run]);

  if (!run) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Starting scaffold…
      </div>
    );
  }

  if (run.phase === "failed") {
    return (
      <div className="py-6 text-center">
        <p className="font-medium text-destructive">Scaffold failed</p>
        {run.message && <p className="text-sm text-muted-foreground">{run.message}</p>}
      </div>
    );
  }

  const terminal = run.phase === "completed";
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {terminal ? (
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      )}
      <p className="font-medium">
        {terminal ? "Scaffold complete" : `Scaffolding — ${run.phase}`}
      </p>
      <Badge variant={terminal ? "success" : "warning"}>{run.phase}</Badge>
      <div className="flex flex-wrap justify-center gap-2">
        {run.outputs.repoUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={run.outputs.repoUrl} target="_blank" rel="noreferrer">
              Open repository
            </a>
          </Button>
        )}
        {run.outputs.pipelineUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={run.outputs.pipelineUrl} target="_blank" rel="noreferrer">
              Open pipeline
            </a>
          </Button>
        )}
        {run.outputs.catalogItemId && (
          <Button asChild size="sm">
            <Link to={tenantLink(tenant, `catalog/${run.outputs.catalogItemId}`)}>
              View catalog entry
            </Link>
          </Button>
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
  const [submitting, setSubmitting] = React.useState(false);
  const [run, setRun] = React.useState<ScaffoldRun | null>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const formRef = React.useRef<SchemaFormHandle>(null);

  if (template.error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive">
          Failed to load template: {template.error.message}
        </CardContent>
      </Card>
    );
  }
  if (!template.data) {
    return <p className="text-sm text-muted-foreground">Loading template…</p>;
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
    try {
      const created = await createScaffold(token, tenant, {
        templateId: tpl.id,
        name,
        parameters: formData,
      });
      setRun(created);
      setStep(2);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Failed to start the scaffold",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scaffold {tpl.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          Template v{tpl.version} · creates repo, pipeline, and catalog entry
        </p>
      </div>
      <StepIndicator current={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configure</CardTitle>
            <CardDescription>
              The tenant context is bound automatically: namespace, owning group, and RBAC
              are derived from the current tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted p-3 text-sm">
              <dt className="text-muted-foreground">Tenant</dt>
              <dd className="font-mono text-xs">{tenant}</dd>
              <dt className="text-muted-foreground">Namespace</dt>
              <dd className="font-mono text-xs">{tenant}</dd>
              <dt className="text-muted-foreground">RBAC group</dt>
              <dd className="font-mono text-xs">tenant-{tenant}</dd>
            </dl>
            <div className="space-y-1.5">
              <Label htmlFor="service-name">Service name</Label>
              <Input
                id="service-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="payments-api"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <SchemaForm
              ref={formRef}
              schema={tpl.schema}
              uiSchema={tpl.uiSchema}
              formData={formData}
              onChange={setFormData}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" asChild>
                <Link to={tenantLink(tenant, "templates")}>Cancel</Link>
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
              The scaffold run creates the repository, CI pipeline, and a discovered catalog
              entry, then binds tenant RBAC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{name}</dd>
              <dt className="text-muted-foreground">Template</dt>
              <dd>{tpl.displayName}</dd>
              <dt className="text-muted-foreground">Tenant</dt>
              <dd>{tenant}</dd>
              <dt className="text-muted-foreground">Namespace</dt>
              <dd>{tenant}</dd>
            </dl>
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {JSON.stringify(formData, null, 2)}
            </pre>
            {submitError && (
              <p className="text-sm text-destructive" role="alert">
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
          </CardContent>
        </Card>
      )}

      {step === 2 && run && (
        <Card>
          <CardHeader>
            <CardTitle>Scaffold status</CardTitle>
            <CardDescription>
              Repo, pipeline, and catalog entry are created by the scaffold run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScaffoldStatus scaffoldId={run.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
