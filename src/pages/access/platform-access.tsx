import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  grantPlatformAdmin,
  listPlatformAdmins,
  revokePlatformAdmin,
} from "@/api/platform-admins";
import { useAuth } from "@/auth/auth-context";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";

// Platform-level RBAC console (/platform/access): lists platform admins and
// grants/revokes membership in the Keycloak platform-admins group via the
// M1.W1 server endpoints. Platform-scoped — no tenant context.
export function PlatformAccessPage() {
  const { token } = useAuth();
  const {
    data: admins,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listPlatformAdmins(t), []);

  const [subject, setSubject] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setBusy(true);
    try {
      await grantPlatformAdmin(token, subject.trim());
      setSubject("");
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to grant platform admin",
      );
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (adminSubject: string) => {
    setActionError(null);
    try {
      await revokePlatformAdmin(token, adminSubject);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to revoke platform admin",
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform access</h1>
        <p className="text-sm text-muted-foreground">
          Platform administrators can create organizations and manage
          platform-level settings.
        </p>
      </div>

      {error && (
        <Card>
          <div className="card-body">
            Failed to load platform admins: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !admins && (
        <p className="text-sm text-muted-foreground">Loading platform admins…</p>
      )}

      {!error && admins && admins.length === 0 && (
        <Card>
          <div className="card-body">
            No platform admins.
          </div>
        </Card>
      )}

      {admins && admins.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.userId} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{admin.displayName}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {admin.email}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => revoke(admin.userId)}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionError && (
        <Card>
          <div className="card-body">
            {actionError}
          </div>
        </Card>
      )}

      {!error && (
        <Card>
          <div className="card-header">
            <h2 className="mono-label">Grant platform admin</h2>
          </div>
          <div className="card-body">
            <form className="flex max-w-xl items-end gap-2" onSubmit={grant}>
              <div className="flex-1 space-y-1.5">
                <label className="form-label" htmlFor="admin-subject">Email or user ID</label>
                <Input
                  id="admin-subject"
                  value={subject}
                  onChange={(v) => setSubject(v)}
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Granting…" : "Grant"}
              </Button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
