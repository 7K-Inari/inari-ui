import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  addTeamMember,
  createTeam,
  deleteOrgMember,
  deleteTeam,
  listOrgMembers,
  listTeamMembers,
  listTeams,
  putOrgMember,
  removeTeamMember,
} from "@/api/tenants";
import type { MemberView, Team } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { useTenant } from "@/tenant/tenant-context";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

const ORG_ROLES = ["org-admin", "platform-engineer", "developer", "viewer"];

function InviteForm({
  tenant,
  disabled,
  onDone,
}: {
  tenant: string;
  disabled: boolean;
  onDone: () => void;
}) {
  const { token } = useAuth();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("viewer");
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSaving(true);
    try {
      // The server resolves an email subject to the Keycloak user id
      // (inari-server tenancy.resolveMemberSubject).
      await putOrgMember(token, tenant, email, { role });
      setEmail("");
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
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={disabled}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              className={selectClass}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={disabled}
            >
              {ORG_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          <CapabilityGate capability="manageMembers" mode="disable">
            <Button type="submit" disabled={saving || disabled}>
              {saving ? "Inviting…" : "Invite"}
            </Button>
          </CapabilityGate>
        </form>
      </CardContent>
    </Card>
  );
}

function MemberRow({
  tenant,
  member,
  canManage,
  onChanged,
}: {
  tenant: string;
  member: MemberView;
  canManage: boolean;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const changeRole = async (role: string) => {
    setActionError(null);
    setBusy(true);
    try {
      await putOrgMember(token, tenant, member.userId, { role });
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
        <select
          aria-label={`Role for ${member.displayName}`}
          className={selectClass}
          value={member.role}
          disabled={!canManage || busy}
          title={canManage ? undefined : "Requires member management permission"}
          onChange={(e) => changeRole(e.target.value)}
        >
          {ORG_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 text-right">
        {actionError && (
          <span className="mr-2 text-xs text-destructive">{actionError}</span>
        )}
        <CapabilityGate capability="manageMembers" mode="disable">
          <Button variant="outline" size="sm" disabled={busy} onClick={remove}>
            Remove
          </Button>
        </CapabilityGate>
      </td>
    </tr>
  );
}

// User picker for team membership: debounced email/name search via
// GET .../members?q= (M1.W1) — replaces raw Keycloak UUID entry.
function UserPicker({
  tenant,
  team,
  exclude,
  disabled,
  onPick,
}: {
  tenant: string;
  team: string;
  exclude: Set<string>;
  disabled: boolean;
  onPick: (member: MemberView) => void;
}) {
  const { token } = useAuth();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<MemberView[] | null>(null);

  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      listOrgMembers(token, tenant, { q })
        .then((members) => {
          if (!cancelled) setResults(members);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, token, tenant]);

  const visible = (results ?? []).filter((m) => !exclude.has(m.userId));

  return (
    <div className="relative flex-1 space-y-1.5">
      <Label htmlFor={`picker-${team}`}>Add member</Label>
      <Input
        id={`picker-${team}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search org members by email or name"
        disabled={disabled}
      />
      {results !== null && !disabled && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md">
          {visible.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No matching org members
            </li>
          )}
          {visible.map((m) => (
            <li key={m.userId}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => {
                  onPick(m);
                  setQuery("");
                  setResults(null);
                }}
              >
                <span>{m.displayName}</span>
                <span className="text-xs text-muted-foreground">{m.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamMembersPanel({
  tenant,
  team,
  canManage,
}: {
  tenant: string;
  team: Team;
  canManage: boolean;
}) {
  const { token } = useAuth();
  const {
    data: members,
    loading,
    error,
    refetch,
  } = useAsyncResource(
    (t) => listTeamMembers(t, tenant, team.name),
    [tenant, team.name],
  );
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const add = async (member: MemberView) => {
    setActionError(null);
    setBusy(true);
    try {
      await addTeamMember(token, tenant, team.name, member.userId);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to add member",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberSubject: string) => {
    setActionError(null);
    try {
      await removeTeamMember(token, tenant, team.name, memberSubject);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to remove member",
      );
    }
  };

  if (error) {
    return (
      <p className="px-4 py-3 text-sm text-destructive">
        Failed to load team members: {error.message}
      </p>
    );
  }
  if (loading && !members) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">Loading members…</p>;
  }

  return (
    <div className="space-y-2 px-4 py-3">
      {members && members.length === 0 && (
        <p className="text-sm text-muted-foreground">No members in this team.</p>
      )}
      {members && members.length > 0 && (
        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between text-sm">
              <span>
                {m.displayName}{" "}
                <span className="text-xs text-muted-foreground">{m.email}</span>
              </span>
              <CapabilityGate capability="manageTeams" mode="disable">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remove(m.userId)}
                >
                  Remove
                </Button>
              </CapabilityGate>
            </li>
          ))}
        </ul>
      )}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      <UserPicker
        tenant={tenant}
        team={team.name}
        exclude={new Set((members ?? []).map((m) => m.userId))}
        disabled={!canManage || busy}
        onPick={add}
      />
    </div>
  );
}

function TeamsSection() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canManageTeams } = useOrgCapabilities();
  const {
    data: teams,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listTeams(t, tenant), [tenant]);

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setCreating(true);
    try {
      await createTeam(token, tenant, { name });
      setName("");
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to create team",
      );
    } finally {
      setCreating(false);
    }
  };

  const remove = async (teamName: string) => {
    setActionError(null);
    try {
      await deleteTeam(token, tenant, teamName);
      if (expanded === teamName) setExpanded(null);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to delete team",
      );
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Teams</h2>
        <p className="text-sm text-muted-foreground">
          Team membership. Team roles are assigned on the Teams &amp; Roles tab.
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load teams: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !teams && (
        <p className="text-sm text-muted-foreground">Loading teams…</p>
      )}

      {!error && teams && teams.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No teams in this organization.
          </CardContent>
        </Card>
      )}

      {teams && teams.length > 0 && (
        <div className="space-y-2">
          {teams.map((team) => (
            <Card key={team.id}>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{team.displayName || team.name}</p>
                  <p className="text-xs text-muted-foreground">{team.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExpanded(expanded === team.name ? null : team.name)
                    }
                  >
                    {expanded === team.name ? "Hide members" : "Members"}
                  </Button>
                  <CapabilityGate capability="manageTeams" mode="disable">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remove(team.name)}
                    >
                      Delete
                    </Button>
                  </CapabilityGate>
                </div>
              </div>
              {expanded === team.name && (
                <div className="border-t">
                  <TeamMembersPanel
                    tenant={tenant}
                    team={team}
                    canManage={canManageTeams}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create team</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex max-w-xl items-end gap-2" onSubmit={create}>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="team-name">Name</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="lowercase-with-dashes"
                disabled={!canManageTeams}
                required
              />
            </div>
            <CapabilityGate capability="manageTeams" mode="disable">
              <Button type="submit" disabled={creating || !canManageTeams}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </CapabilityGate>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

export function MembersTab() {
  const { tenant } = useTenant();
  const { canManageMembers } = useOrgCapabilities();
  const {
    data: members,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listOrgMembers(t, tenant), [tenant]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Members</h2>
          <p className="text-sm text-muted-foreground">
            Org-wide membership and role assignment.
            {!canManageMembers && (
              <Badge variant="muted" className="ml-2">
                Read-only
              </Badge>
            )}
          </p>
        </div>

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
                    canManage={canManageMembers}
                    onChanged={refetch}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <InviteForm tenant={tenant} disabled={!canManageMembers} onDone={refetch} />
      </section>

      <TeamsSection />
    </div>
  );
}
