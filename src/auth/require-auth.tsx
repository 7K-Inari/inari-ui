import * as React from "react";

import { useAuth } from "@/auth/auth-context";
import { Button } from "7k-design-system/react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { initialized, authenticated, error, login, retry } = useAuth();

  React.useEffect(() => {
    if (initialized && !authenticated && !error) login();
  }, [initialized, authenticated, error, login]);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center u-muted">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">Unable to sign in</p>
        <p className="max-w-md text-sm u-muted">
          The identity provider could not be reached. Check that you have
          network access to the platform and try again.
        </p>
        <p className="text-xs u-muted">{error.message}</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex h-screen items-center justify-center u-muted">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
