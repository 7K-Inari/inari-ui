import * as React from "react";

import { fetchMyPermissions, type MyPermissions } from "@/api/me";
import { useAuth } from "@/auth/auth-context";

const CONSERVATIVE_DEFAULT: MyPermissions = { canCreateOrganizations: false };

const PermissionsContext = React.createContext<MyPermissions>(CONSERVATIVE_DEFAULT);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { token, authenticated } = useAuth();
  const [permissions, setPermissions] = React.useState<MyPermissions>(CONSERVATIVE_DEFAULT);

  React.useEffect(() => {
    if (!authenticated || !token) {
      setPermissions(CONSERVATIVE_DEFAULT);
      return;
    }
    let cancelled = false;
    fetchMyPermissions(token)
      .then((result) => {
        if (!cancelled) setPermissions(result);
      })
      .catch(() => {
        if (!cancelled) setPermissions(CONSERVATIVE_DEFAULT);
      });
    return () => {
      cancelled = true;
    };
  }, [token, authenticated]);

  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): MyPermissions {
  return React.useContext(PermissionsContext);
}
