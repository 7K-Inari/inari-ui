import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  grantPlatformAdmin,
  listPlatformAdmins,
  revokePlatformAdmin,
} from "@/api/platform-admins";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load platform admins: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !admins && (
        <p className="text-sm text-muted-foreground">Loading platform admins…</p>
      )}

      {!error && admins && admins.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No platform admins.
          </CardContent>
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
                <tr key={admin.subject} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">
                    {admin.displayName ?? admin.subject}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {admin.email ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revoke(admin.subject)}
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
          <CardContent className="py-3 text-sm text-destructive">
            {actionError}
          </CardContent>
        </Card>
      )}

      {!error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grant platform admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex max-w-xl items-end gap-2" onSubmit={grant}>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="admin-subject">Email or user ID</Label>
                <Input
                  id="admin-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Granting…" : "Grant"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
