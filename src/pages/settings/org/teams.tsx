import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  listTeamMembers,
  listTeams,
  removeTeamMember,
} from "@/api/tenants";
import type { Team } from "@/api/tenants";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgCapabilities } from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

function TeamMembersPanel({ tenant, team }: { tenant: string; team: Team }) {
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: members,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listTeamMembers(t, tenant, team.name), [tenant, team.name]);
  const [subject, setSubject] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setBusy(true);
    try {
      await addTeamMember(token, tenant, team.name, subject);
      setSubject("");
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
              {canWriteSettings && (
                <Button variant="outline" size="sm" onClick={() => remove(m.userId)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      {canWriteSettings && (
        <form className="flex items-end gap-2" onSubmit={add}>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`add-${team.name}`}>User ID</Label>
            <Input
              id={`add-${team.name}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Keycloak user id"
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add member"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function TeamsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
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
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Teams"
        description="Team CRUD and per-team membership."
        actions={
          !canWriteSettings ? (
            <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
          ) : undefined
        }
      />

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
                  <p className="text-sm font-medium">{team.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {team.keycloakGroupPath}
                  </p>
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
                  {canWriteSettings && (
                    <Button variant="outline" size="sm" onClick={() => remove(team.name)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
              {expanded === team.name && (
                <div className="border-t">
                  <TeamMembersPanel tenant={tenant} team={team} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {canWriteSettings && (
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
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
