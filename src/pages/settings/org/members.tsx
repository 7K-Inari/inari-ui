import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  deleteOrgMember,
  listOrgMembers,
  putOrgMember,
} from "@/api/tenants";
import type { MemberView } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function InviteForm({
  tenant,
  onDone,
}: {
  tenant: string;
  onDone: () => void;
}) {
  const { token } = useAuth();
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [role, setRole] = React.useState("member");
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSaving(true);
    try {
      // The Keycloak subject is derived from the email in the mock; the
      // server resolves invites to a user id.
      await putOrgMember(token, tenant, email, {
        email,
        displayName: displayName || undefined,
        role,
      });
      onDone();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to invite member",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite member</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="max-w-xl space-y-3" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Display name</Label>
              <Input
                id="invite-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              className={selectClass}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
              <option value="viewer">viewer</option>
            </select>
          </div>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Inviting…" : "Invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MemberRow({
  tenant,
  member,
  canWrite,
  onChanged,
}: {
  tenant: string;
  member: MemberView;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const changeRole = async (role: string) => {
    setActionError(null);
    setBusy(true);
    try {
      await putOrgMember(token, tenant, member.userId, {
        email: member.email,
        displayName: member.displayName,
        role,
      });
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to update role",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setActionError(null);
    setBusy(true);
    try {
      await deleteOrgMember(token, tenant, member.userId);
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to remove member",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-2 font-medium">{member.displayName}</td>
      <td className="px-4 py-2 text-muted-foreground">{member.email}</td>
      <td className="px-4 py-2">
        {canWrite ? (
          <select
            aria-label={`Role for ${member.displayName}`}
            className={selectClass}
            value={member.role}
            disabled={busy}
            onChange={(e) => changeRole(e.target.value)}
          >
            <option value="admin">admin</option>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </select>
        ) : (
          <Badge variant="muted">{member.role}</Badge>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        {actionError && (
          <span className="mr-2 text-xs text-destructive">{actionError}</span>
        )}
        {canWrite && (
          <Button variant="outline" size="sm" disabled={busy} onClick={remove}>
            Remove
          </Button>
        )}
      </td>
    </tr>
  );
}

export function MembersPage() {
  const { tenant } = useTenant();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: members,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listOrgMembers(t, tenant), [tenant]);

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Members"
        description="Org-wide membership and role assignment."
        actions={
          !canWriteSettings ? (
            <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
          ) : undefined
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load members: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !members && (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      )}

      {!error && members && members.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No members in this organization.
          </CardContent>
        </Card>
      )}

      {members && members.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.userId}
                  tenant={tenant}
                  member={m}
                  canWrite={canWriteSettings}
                  onChanged={refetch}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canWriteSettings && <InviteForm tenant={tenant} onDone={refetch} />}
    </div>
  );
}
