import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";

import type { CloudAccount } from "@/api/cloud-accounts";
import { createCloudAccount, validateCloudAccount } from "@/api/cloud-accounts";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { CopyButton } from "@/pages/cloud-accounts/copy-button";

const ACCOUNT_ID_PATTERN = /^\d{12}$/;
const ROLE_ARN_PATTERN = /^arn:aws:iam::\d{12}:role\/.+$/;

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

// The trust role values the tenant must wire into their IAM role. The platform
// cluster OIDC provider must be trusted with these exact conditions.
export function TrustRoleFacts({ account }: { account: CloudAccount }) {
  const facts: Array<{ label: string; value: string }> = [
    { label: "Issuer URL", value: account.issuerUrl ?? "—" },
    { label: "Role ARN", value: account.roleArn },
    { label: "ExternalId", value: account.externalId },
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

// Renders the outcome of an on-demand validation. The server returns the
// updated account envelope; the outcome is derived from its state fields.
export function ValidationStateView({
  account,
  accountId,
  tenant,
}: {
  account: CloudAccount;
  accountId: string;
  tenant: string;
}) {
  if (account.status === "connected") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
        <p className="text-lg font-semibold">Account connected</p>
        <p className="text-sm text-muted-foreground">
          Dry-run AssumeRole succeeded; the account is ready for managed resources.
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
        {account.statusMessage ?? "The trust role could not be assumed."}
      </p>
      <p className="text-xs text-muted-foreground">
        Re-check the trust policy: the OIDC issuer and subject must match the platform cluster,
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
  const [accountIdInput, setAccountIdInput] = React.useState("");
  const [roleArnInput, setRoleArnInput] = React.useState("");
  const [externalIdInput, setExternalIdInput] = React.useState("");
  const [accountIdError, setAccountIdError] = React.useState<string | null>(null);
  const [roleArnError, setRoleArnError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<CloudAccount | null>(null);
  const [validation, setValidation] = React.useState<CloudAccount | null>(null);
  const [validating, setValidating] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    if (!ACCOUNT_ID_PATTERN.test(accountIdInput)) {
      setAccountIdError("Enter the 12-digit AWS account ID (numbers only).");
      valid = false;
    } else {
      setAccountIdError(null);
    }
    if (!ROLE_ARN_PATTERN.test(roleArnInput.trim())) {
      setRoleArnError(
        "Enter the role ARN (arn:aws:iam::<12-digit account>:role/<name>).",
      );
      valid = false;
    } else {
      setRoleArnError(null);
    }
    if (!valid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createCloudAccount(token, tenant, {
        accountId: accountIdInput,
        roleArn: roleArnInput.trim(),
        externalId: externalIdInput.trim() || undefined,
        provider: "aws",
        runContext: "tenant",
      });
      setCreated(res.account);
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
      const account = await validateCloudAccount(token, created.id, tenant);
      setValidation(account);
    } catch (err) {
      setValidation({
        ...created,
        status: "failed",
        statusMessage: err instanceof Error ? err.message : "Validation request failed",
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
              This registers the cloud account record. You will then create the trust role in your
              AWS account and validate the connection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
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
                <Label htmlFor="role-arn">Role ARN</Label>
                <Input
                  id="role-arn"
                  value={roleArnInput}
                  onChange={(e) => setRoleArnInput(e.target.value)}
                  placeholder="arn:aws:iam::123456789012:role/inari-platform-access"
                  required
                />
                {roleArnError && <p className="text-xs text-destructive">{roleArnError}</p>}
                <p className="text-xs text-muted-foreground">
                  The ARN of the IAM role the platform will assume in this account.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="external-id">External ID (optional)</Label>
                <Input
                  id="external-id"
                  value={externalIdInput}
                  onChange={(e) => setExternalIdInput(e.target.value)}
                  placeholder="Generated if left empty"
                />
                <p className="text-xs text-muted-foreground">
                  The ExternalId condition for the AssumeRole statement in the trust policy.
                </p>
              </div>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !accountIdInput || !roleArnInput}>
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
              <code className="font-mono text-xs">{created.accountId}</code>, create the trust role
              so the platform can assume{" "}
              <code className="font-mono text-xs">{created.roleArn}</code>. This is a one-time
              setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrustRoleFacts account={created} />
            <div className="flex items-center justify-between gap-2">
              <CopyButton value={created.externalId} label="Copy ExternalId" />
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
              <code className="font-mono text-xs">{created.roleArn}</code>.
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
              <ValidationStateView
                account={validation}
                accountId={created.id}
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
