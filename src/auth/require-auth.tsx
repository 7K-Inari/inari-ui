import * as React from "react";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { initialized, authenticated, error, login, retry } = useAuth();

  React.useEffect(() => {
    if (initialized && !authenticated && !error) login();
  }, [initialized, authenticated, error, login]);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">Unable to sign in</p>
        <p className="max-w-md text-sm text-muted-foreground">
          The identity provider could not be reached. Check that you have
          network access to the platform and try again.
        </p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
