import { KeyRound, ShieldAlert } from "lucide-react";

import type { ExtensionAuthError } from "@/ext/sso-session";
import { PolicyDenialNotice } from "@/components/policy-denial";

// Renders classified extension action failures (W4): downstream permission
// denied (e.g. ArgoCD RBAC) is distinct from Inari FGA policy denials and
// from session bootstrap failures, which offer a manual sign-in retry.
export function ExtensionAuthErrorNotice({
  error,
  extensionName = "the extension service",
  onRetry,
}: {
  error: ExtensionAuthError;
  extensionName?: string;
  onRetry?: () => void;
}) {
  if (error.kind === "policy") {
    return <PolicyDenialNotice reason={error.message} remediation={error.remediation} />;
  }

  if (error.kind === "downstream-denied") {
    return (
      <div
        role="alert"
        className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
      >
        <div className="flex items-center gap-2 font-medium text-destructive">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          Insufficient {extensionName} permissions
        </div>
        <p className="text-destructive">
          Your account doesn't have permission to perform this action in {extensionName}.
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Detail: </span>
          {error.message}
        </p>
        <p className="text-muted-foreground">
          Ask your {extensionName} administrator to grant the required role, then try again.
        </p>
      </div>
    );
  }

  if (error.kind === "session") {
    return (
      <div
        role="alert"
        className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
      >
        <div className="flex items-center gap-2 font-medium text-destructive">
          <KeyRound className="h-4 w-4" aria-hidden />
          Extension sign-in failed
        </div>
        <p className="text-destructive">
          We couldn't sign you in to {extensionName}. {error.message}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            Retry sign-in
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium text-destructive">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        Extension action failed
      </div>
      <p className="text-destructive">Something went wrong: {error.message}</p>
    </div>
  );
}
