import * as React from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { ExtensionAuthErrorNotice } from "@/components/extension-auth-error";
import {
  ExtensionAuthError,
  beginExtensionSsoRedirect,
  completeExtensionSsoCallback,
  peekPendingSso,
} from "@/ext/sso-session";

// Landing route for the zero-prompt extension SSO round-trip (W4). Hands the
// third-party session material to the control plane, then returns the user to
// the page that triggered the bootstrap.
export function ExtensionSsoCallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = React.useState<ExtensionAuthError | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    completeExtensionSsoCallback(auth.token)
      .then((returnTo) => {
        if (!cancelled) navigate(returnTo, { replace: true });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ExtensionAuthError
            ? err
            : new ExtensionAuthError("unknown", err instanceof Error ? err.message : String(err)),
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = React.useCallback(() => {
    const pending = peekPendingSso();
    if (!pending?.ssoLoginBaseUrl) return;
    beginExtensionSsoRedirect({
      tenant: pending.tenant,
      extensionId: pending.extensionId,
      ssoLoginBaseUrl: pending.ssoLoginBaseUrl,
      returnTo: pending.returnTo,
    });
  }, []);

  if (error) {
    const canRetry = peekPendingSso()?.ssoLoginBaseUrl !== undefined;
    return (
      <div className="mx-auto mt-16 max-w-md">
        <ExtensionAuthErrorNotice error={error} onRetry={canRetry ? retry : undefined} />
      </div>
    );
  }
  return (
    <div className="mx-auto mt-16 max-w-md text-sm text-muted-foreground">
      Signing you in to the extension service…
    </div>
  );
}
