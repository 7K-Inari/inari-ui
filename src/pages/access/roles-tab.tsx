import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  createRole,
  deleteRole,
  getPermissionCatalog,
  listRoles,
  updateRole,
  type Permission,
  type Role,
} from "@/api/roles";
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

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// Permission catalog grouped by its server-provided domain (ADR-0013 static
// catalog) so the editor reads like the console IA instead of a flat slug list.
function groupByDomain(permissions: Permission[]): [string, Permission[]][] {
  const groups = new Map<string, Permission[]>();
  for (const p of permissions) {
    const list = groups.get(p.domain) ?? [];
    list.push(p);
    groups.set(p.domain, list);
  }
  return [...groups.entries()];
}

interface RoleDraft {
  name: string;
  displayName: string;
  description: string;
  permissions: Set<string>;
}

function emptyDraft(): RoleDraft {
  return { name: "", displayName: "", description: "", permissions: new Set() };
}

function draftFromRole(role: Role): RoleDraft {
  return {
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    permissions: new Set(role.permissions ?? []),
  };
}

function RoleEditor({
  tenant,
  catalog,
  role,
  disabled,
  onDone,
  onCancel,
}: {
  tenant: string;
  catalog: Permission[];
  // null = create a custom role; otherwise edit this role.
  role: Role | null;
  disabled: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { token } = useAuth();
  const [draft, setDraft] = React.useState<RoleDraft>(() =>
    role ? draftFromRole(role) : emptyDraft(),
  );
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Built-in names are immutable (they double as the pinned ClusterRole
  // suffixes); only custom roles may be named/renamed.
  const nameEditable = role === null || !role.builtin;
  const nameValid = NAME_PATTERN.test(draft.name);

  const toggle = (slug: string) => {
    const next = new Set(draft.permissions);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    setDraft({ ...draft, permissions: next });
    setActionError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSaving(true);
    const permissions = [...draft.permissions];
    try {
      if (role === null) {
        await createRole(token, tenant, {
          name: draft.name,
          displayName: draft.displayName,
          description: draft.description,
          permissions,
        });
      } else {
        await updateRole(token, tenant, role.id, {
          ...(nameEditable && draft.name !== role.name
            ? { name: draft.name }
            : {}),
          displayName: draft.displayName,
          description: draft.description,
          permissions,
        });
      }
      onDone();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save role",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {role === null ? "Create role" : `Edit ${role.displayName || role.name}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="lowercase-with-dashes"
                disabled={disabled || !nameEditable}
                title={
                  nameEditable
                    ? "DNS-1123 name; suffix of the tenant ClusterRole"
                    : "Built-in role names are immutable"
                }
                required
              />
              {!nameValid && draft.name !== "" && (
                <p className="text-xs text-destructive">
                  Lowercase alphanumeric with dashes, starting with a letter or digit.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-display-name">Display name</Label>
              <Input
                id="role-display-name"
                value={draft.displayName}
                onChange={(e) =>
                  setDraft({ ...draft, displayName: e.target.value })
                }
                disabled={disabled}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              disabled={disabled}
            />
          </div>

          <fieldset className="space-y-3" disabled={disabled}>
            <legend className="text-sm font-medium">Permissions</legend>
            {groupByDomain(catalog).map(([domain, permissions]) => (
              <div key={domain} className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {domain}
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {permissions.map((p) => (
                    <label
                      key={p.slug}
                      className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                      title={p.description}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 border-input accent-primary"
                        checked={draft.permissions.has(p.slug)}
                        disabled={disabled}
                        onChange={() => toggle(p.slug)}
                      />
                      <span>
                        <span className="font-medium">{p.name}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {p.slug}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          {role?.builtin && (
            <p className="text-xs text-muted-foreground">
              Built-in role: the name is fixed, but the permission bundle is
              editable. The server rejects edits that would leave the
              organization without an admin.
            </p>
          )}
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <div className="flex gap-2">
            <CapabilityGate capability="manageRbac" mode="disable">
              <Button type="submit" disabled={saving || disabled || !nameValid}>
                {saving ? "Saving…" : role === null ? "Create" : "Save"}
              </Button>
            </CapabilityGate>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function RolesTab() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canManageRbac } = useOrgCapabilities();
  const {
    data: roles,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listRoles(t, tenant), [tenant]);
  const { data: catalog } = useAsyncResource(
    (t) => getPermissionCatalog(t, tenant),
    [tenant],
  );

  // Editor state: "new" for create, a role id for edit, null when closed.
  const [editing, setEditing] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const remove = async (role: Role) => {
    if (
      !window.confirm(
        `Delete role "${role.displayName || role.name}"? Teams mapped to it will lose the mapping.`,
      )
    ) {
      return;
    }
    setActionError(null);
    setDeleting(true);
    try {
      await deleteRole(token, tenant, role.id);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to delete role",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Failed to load roles: {error.message}
        </CardContent>
      </Card>
    );
  }
  if (loading && !roles) {
    return <p className="text-sm text-muted-foreground">Loading roles…</p>;
  }

  const editRole = editing && editing !== "new"
    ? (roles ?? []).find((r) => r.id === editing) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Org roles bundle permissions from the static catalog. Built-in roles
          are never deletable; custom roles bound to teams cannot be deleted.
          {!canManageRbac && (
            <Badge variant="muted" className="ml-2">
              Read-only
            </Badge>
          )}
        </p>
        {editing === null && (
          <CapabilityGate capability="manageRbac" mode="disable">
            <Button onClick={() => setEditing("new")}>New role</Button>
          </CapabilityGate>
        )}
      </div>

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">
            {actionError}
          </CardContent>
        </Card>
      )}

      {roles && roles.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Permissions</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <span className="font-medium">
                      {role.displayName || role.name}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {role.name}
                    </span>{" "}
                    {role.builtin && <Badge variant="muted">Built-in</Badge>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {(role.permissions ?? []).length}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {role.description}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <CapabilityGate capability="manageRbac" mode="disable">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(role.id)}
                        >
                          Edit
                        </Button>
                      </CapabilityGate>
                      {!role.builtin && (
                        <CapabilityGate capability="manageRbac" mode="disable">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deleting}
                            onClick={() => remove(role)}
                          >
                            Delete
                          </Button>
                        </CapabilityGate>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {roles && roles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No roles in this organization.
          </CardContent>
        </Card>
      )}

      {editing !== null && (
        <RoleEditor
          tenant={tenant}
          catalog={catalog ?? []}
          role={editing === "new" ? null : editRole}
          disabled={!canManageRbac}
          onDone={() => {
            setEditing(null);
            refetch();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
