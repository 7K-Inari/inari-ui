import * as React from "react";

import { useAuth } from "@/auth/auth-context";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { initialized, authenticated, login } = useAuth();

  React.useEffect(() => {
    if (initialized && !authenticated) login();
  }, [initialized, authenticated, login]);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
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
