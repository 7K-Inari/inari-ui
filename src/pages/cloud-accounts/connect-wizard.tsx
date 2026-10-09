import * as React from "react";
import { Stepper } from "@/components/stepper";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";

import type { CloudAccount } from "@/api/cloud-accounts";
import { createCloudAccount, validateCloudAccount } from "@/api/cloud-accounts";
import { useAuth } from "@/auth/auth-context";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
import { useTenant } from "@/tenant/tenant-context";
import { tenantLink } from "@/tenant/tenant-link";
import { CopyButton } from "@/pages/cloud-accounts/copy-button";

const ACCOUNT_ID_PATTERN = /^\d{12}$/;
const ROLE_ARN_PATTERN = /^arn:aws:iam::\d{12}:role\/.+$/;

const STEPS = ["Account details", "Create the trust role", "Validate"] as const;


// The trust role values the tenant must wire into their IAM role. The platform
// cluster OIDC provider must be trusted with these exact conditions.
export function TrustRoleFacts({ account }: { account: CloudAccount }) {
  const facts: Array<{ label: string; value: string }> = [
    { label: "Issuer URL", value: account.issuerUrl ?? "—" },
    { label: "Role ARN", value: account.roleArn },
    { label: "ExternalId", value: account.externalId },
  ];
  return (
    <dl className="space-y-2 rounded-md border u-raised/40 p-3 text-xs">
      {facts.map((f) => (
        <div key={f.label} className="flex items-start justify-between gap-4">
          <dt className="shrink-0 u-muted">{f.label}</dt>
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
        <p className="text-sm u-muted">
          Dry-run AssumeRole succeeded; the account is ready for managed resources.
        </p>
        <Link to={tenantLink(tenant, `cloud-accounts/${accountId}`)} className="btn btn-secondary">Open account detail</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-md border border-destructive/40 u-danger-bg/10 p-4">
      <p className="text-sm font-medium u-danger">Validation failed</p>
      <p className="text-sm u-danger" data-testid="validation-error">
        {account.statusMessage ?? "The trust role could not be assumed."}
      </p>
      <p className="text-xs u-muted">
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
        <h1 className="page-header-title">Connect AWS account</h1>
        <p className="text-sm u-muted">
          Grant the platform access to an AWS account via a trust role. No access keys or
          credentials are stored.
        </p>
      </div>
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Account details</h2>
            <p className="card-lede">
              This registers the cloud account record. You will then create the trust role in your
              AWS account and validate the connection.
            </p>
          </div>
          <div className="card-body">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="aws-account-id">AWS account ID</label>
                <Input
                  id="aws-account-id"
                  value={accountIdInput}
                  onChange={(v) => setAccountIdInput(v)}
                  placeholder="123456789012"
                  required
                />
                {accountIdError && <p className="text-xs u-danger">{accountIdError}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="role-arn">Role ARN</label>
                <Input
                  id="role-arn"
                  value={roleArnInput}
                  onChange={(v) => setRoleArnInput(v)}
                  placeholder="arn:aws:iam::123456789012:role/inari-platform-access"
                  required
                />
                {roleArnError && <p className="text-xs u-danger">{roleArnError}</p>}
                <p className="text-xs u-muted">
                  The ARN of the IAM role the platform will assume in this account.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="form-label" htmlFor="external-id">External ID (optional)</label>
                <Input
                  id="external-id"
                  value={externalIdInput}
                  onChange={(v) => setExternalIdInput(v)}
                  placeholder="Generated if left empty"
                />
                <p className="text-xs u-muted">
                  The ExternalId condition for the AssumeRole statement in the trust policy.
                </p>
              </div>
              {submitError && <p className="text-sm u-danger">{submitError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !accountIdInput || !roleArnInput}>
                  {submitting ? "Creating…" : "Create account record"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {step === 1 && created && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Create the trust role</h2>
            <p className="card-lede">
              No credentials are stored on the platform. In your AWS account{" "}
              <code className="font-mono text-xs">{created.accountId}</code>, create the trust role
              so the platform can assume{" "}
              <code className="font-mono text-xs">{created.roleArn}</code>. This is a one-time
              setup.
            </p>
          </div>
          <div className="card-body">
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
          </div>
        </Card>
      )}

      {step === 2 && created && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Validate the connection</h2>
            <p className="card-lede">
              The platform performs a dry-run AssumeRole against{" "}
              <code className="font-mono text-xs">{created.roleArn}</code>.
            </p>
          </div>
          <div className="card-body">
            {validating && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin u-brand" aria-hidden />
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
          </div>
        </Card>
      )}
    </div>
  );
}
