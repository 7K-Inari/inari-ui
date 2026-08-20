import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";

import type { TrustSnippet, ValidationResult } from "@/api/cloud-accounts";
import { createCloudAccount, validateCloudAccount } from "@/api/cloud-accounts";
import type { CloudAccount } from "@/api/cloud-accounts";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { CopyButton } from "@/pages/cloud-accounts/copy-button";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const ACCOUNT_ID_PATTERN = /^\d{12}$/;

const STEPS = ["Account details", "Create the trust role", "Validate"] as const;

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
          <span className={i <= current ? "font-medium" : "text-muted-foreground"}>{label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

export function TrustSnippetTabs({ trust }: { trust: TrustSnippet }) {
  const [tab, setTab] = React.useState<"cloudformation" | "terraform">("cloudformation");
  const snippet = tab === "cloudformation" ? trust.cloudformation : trust.terraform;
  return (
    <div className="space-y-2">
      <div className="flex gap-1" role="tablist" aria-label="Trust setup method">
        <Button
          role="tab"
          aria-selected={tab === "cloudformation"}
          variant={tab === "cloudformation" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("cloudformation")}
        >
          CloudFormation
        </Button>
        <Button
          role="tab"
          aria-selected={tab === "terraform"}
          variant={tab === "terraform" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("terraform")}
        >
          Terraform
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
        {snippet}
      </pre>
      <CopyButton value={snippet} label={`Copy ${tab === "cloudformation" ? "template" : "config"}`} />
    </div>
  );
}

export function TrustFacts({ trust }: { trust: TrustSnippet }) {
  const facts: Array<{ label: string; value: string }> = [
    { label: "OIDC provider ARN", value: trust.oidcProviderArn },
    { label: "Issuer URL", value: trust.issuerUrl },
    { label: "Required sub condition", value: trust.subject },
    { label: "Required aud condition", value: trust.audience },
    { label: "ExternalId", value: trust.externalId },
  ];
  return (
    <dl className="space-y-2 rounded-md border bg-muted/40 p-3 text-xs">
      {facts.map((f) => (
        <div key={f.label} className="flex items-start justify-between gap-4">
          <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
          <dd className="break-all text-right font-mono">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ValidationResultView({
  result,
  accountId,
  tenant,
}: {
  result: ValidationResult;
  accountId: string;
  tenant: string;
}) {
  if (result.status === "ok") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
        <p className="text-lg font-semibold">Account connected</p>
        <p className="text-sm text-muted-foreground">
          {result.message}
          {result.providerConfigName ? (
            <>
              {" "}
              ProviderConfig <code className="font-mono text-xs">{result.providerConfigName}</code>{" "}
              is ready.
            </>
          ) : null}
        </p>
        <Button asChild variant="outline">
          <Link to={tenantLink(tenant, `cloud-accounts/${accountId}`)}>Open account detail</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
      <p className="text-sm font-medium text-destructive">Validation failed</p>
      <p className="text-sm text-destructive" data-testid="validation-error">
        {result.message}
      </p>
      <p className="text-xs text-muted-foreground">
        Re-check the trust policy: the sub and aud conditions must match the values above exactly,
        and the ExternalId condition must be present on the AssumeRole statement.
      </p>
    </div>
  );
}

export function ConnectAccountWizardPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [accountIdInput, setAccountIdInput] = React.useState("");
  const [regionsInput, setRegionsInput] = React.useState("eu-west-1");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [accountIdError, setAccountIdError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<{
    account: CloudAccount;
    trust: TrustSnippet;
  } | null>(null);
  const [validation, setValidation] = React.useState<ValidationResult | null>(null);
  const [validating, setValidating] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    if (!NAME_PATTERN.test(name)) {
      setNameError("Use lowercase letters, numbers, and dashes (e.g. acme-prod).");
      valid = false;
    } else {
      setNameError(null);
    }
    if (!ACCOUNT_ID_PATTERN.test(accountIdInput)) {
      setAccountIdError("Enter the 12-digit AWS account ID (numbers only).");
      valid = false;
    } else {
      setAccountIdError(null);
    }
    if (!valid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const regions = regionsInput
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      const res = await createCloudAccount(token, tenant, {
        provider: "aws",
        name,
        accountId: accountIdInput,
        regions,
      });
      setCreated(res);
      setStep(1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to connect account");
    } finally {
      setSubmitting(false);
    }
  };

  const runValidation = React.useCallback(async () => {
    if (!created) return;
    setValidating(true);
    setValidation(null);
    try {
      const result = await validateCloudAccount(token, created.account.id, tenant);
      setValidation(result);
    } catch (err) {
      setValidation({
        status: "failed",
        message: err instanceof Error ? err.message : "Validation request failed",
        providerConfigName: null,
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setValidating(false);
    }
  }, [created, token, tenant]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect AWS account</h1>
        <p className="text-sm text-muted-foreground">
          Grant the platform access to an AWS account via a trust role. No access keys or
          credentials are stored.
        </p>
      </div>
      <StepIndicator current={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>
              This creates a cloud account record and generates the trust policy you will apply in
              your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="account-name">Name</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="acme-prod"
                  required
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aws-account-id">AWS account ID</Label>
                <Input
                  id="aws-account-id"
                  value={accountIdInput}
                  onChange={(e) => setAccountIdInput(e.target.value)}
                  placeholder="123456789012"
                  required
                />
                {accountIdError && <p className="text-xs text-destructive">{accountIdError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-regions">Regions</Label>
                <Input
                  id="account-regions"
                  value={regionsInput}
                  onChange={(e) => setRegionsInput(e.target.value)}
                  placeholder="eu-west-1, eu-central-1"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated; managed resources are provisioned in these regions.
                </p>
              </div>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name || !accountIdInput}>
                  {submitting ? "Creating…" : "Create account record"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 1 && created && (
        <Card>
          <CardHeader>
            <CardTitle>Create the trust role</CardTitle>
            <CardDescription>
              No credentials are stored on the platform. In your AWS account{" "}
              <code className="font-mono text-xs">{created.account.accountId}</code>, create the
              role <code className="font-mono text-xs">inari-platform-access</code> trusting the
              platform cluster&apos;s OIDC provider. This is a one-time setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrustFacts trust={created.trust} />
            <TrustSnippetTabs trust={created.trust} />
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setStep(2);
                  runValidation();
                }}
              >
                I&apos;ve created the role — validate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && created && (
        <Card>
          <CardHeader>
            <CardTitle>Validate the connection</CardTitle>
            <CardDescription>
              The platform performs a dry-run AssumeRole against{" "}
              <code className="font-mono text-xs">{created.account.roleArn}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validating && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                <p className="font-medium">Validating the trust role…</p>
              </div>
            )}
            {!validating && validation && (
              <ValidationResultView
                result={validation}
                accountId={created.account.id}
                tenant={tenant}
              />
            )}
            {!validating && validation?.status === "failed" && (
              <div className="flex justify-end">
                <Button onClick={runValidation}>Retry validation</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
