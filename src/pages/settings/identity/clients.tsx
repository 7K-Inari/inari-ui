import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  createOidcClient,
  deleteOidcClient,
  listOidcClients,
  rotateClientSecret,
  updateOidcClient,
  type ClientSecret,
  type OidcClient,
  type OidcClientInput,
} from "@/api/identity";
import { useAuth } from "@/auth/auth-context";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/time";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { ClientSecretDialog } from "@/pages/settings/identity/components/client-secret-dialog";
import { useTenant } from "@/tenant/tenant-context";

const CLIENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string", title: "Name" },
    description: { type: "string", title: "Description" },
    redirectUris: {
      type: "array",
      title: "Redirect URIs",
      items: { type: "string" },
      default: [],
    },
    grantTypes: {
      type: "array",
      title: "Grant types",
      items: {
        type: "string",
        enum: ["authorization_code", "client_credentials", "refresh_token"],
      },
      uniqueItems: true,
      default: [],
    },
    isPublic: { type: "boolean", title: "Public client (no secret)", default: false },
  },
};

function toInput(data: Record<string, unknown>): OidcClientInput {
  return {
    name: String(data.name ?? ""),
    description: data.description ? String(data.description) : undefined,
    redirectUris: Array.isArray(data.redirectUris)
      ? (data.redirectUris as unknown[]).map(String)
      : [],
    grantTypes: Array.isArray(data.grantTypes)
      ? (data.grantTypes as unknown[]).map(String)
      : [],
    isPublic: Boolean(data.isPublic),
  };
}

export function OidcClientsPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: clients,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listOidcClients(t, tenant), [tenant]);

  const [editing, setEditing] = React.useState<OidcClient | "new" | null>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [secret, setSecret] = React.useState<ClientSecret | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const formRef = React.useRef<SchemaFormHandle>(null);

  const fail = (err: unknown, fallback: string) =>
    setActionError(err instanceof ApiError ? err.message : fallback);

  const openCreate = () => {
    setFormData({ redirectUris: [], grantTypes: [], isPublic: false });
    setEditing("new");
    setActionError(null);
  };

  const openEdit = (client: OidcClient) => {
    setFormData({
      name: client.name,
      description: client.description,
      redirectUris: client.redirectUris,
      grantTypes: client.grantTypes,
      isPublic: client.isPublic,
    });
    setEditing(client);
    setActionError(null);
  };

  const submit = async () => {
    if (!formRef.current?.validate()) return;
    setActionError(null);
    try {
      if (editing === "new") {
        const res = await createOidcClient(token, tenant, toInput(formData));
        if (res.secret) setSecret(res.secret);
      } else if (editing) {
        await updateOidcClient(token, tenant, editing.id, toInput(formData));
      }
      setEditing(null);
      refetch();
    } catch (err) {
      fail(err, "Failed to save client");
    }
  };

  const rotate = async (client: OidcClient) => {
    if (!window.confirm(`Rotate the secret for client "${client.name}"? The old secret stops working immediately.`)) {
      return;
    }
    setActionError(null);
    try {
      setSecret(await rotateClientSecret(token, tenant, client.id));
    } catch (err) {
      fail(err, "Failed to rotate secret");
    }
  };

  const remove = async (client: OidcClient) => {
    if (!window.confirm(`Delete client "${client.name}"?`)) return;
    setActionError(null);
    try {
      await deleteOidcClient(token, tenant, client.id);
      refetch();
    } catch (err) {
      fail(err, "Failed to delete client");
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="OIDC clients"
        description="Service and public clients for agents, CLI, and CI (Keycloak inari realm)."
        actions={
          <CapabilityGate
            capability="admin"
            fallback={
              <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
            }
          >
            <Button onClick={() => (editing ? setEditing(null) : openCreate())}>
              {editing ? "Cancel" : "New client"}
            </Button>
          </CapabilityGate>
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load OIDC clients: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !clients && (
        <p className="text-sm text-muted-foreground">Loading OIDC clients…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {secret && <ClientSecretDialog secret={secret} onClose={() => setSecret(null)} />}

      {editing && canWriteSettings && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <SchemaForm
              ref={formRef}
              schema={CLIENT_SCHEMA}
              formData={formData}
              onChange={setFormData}
            />
            <Button onClick={submit}>
              {editing === "new" ? "Create client" : "Save client"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && clients && clients.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No OIDC clients yet.
          </CardContent>
        </Card>
      )}

      {clients && clients.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Grant types</th>
                <th className="px-4 py-2 font-medium">Scopes</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{client.name}</td>
                  <td className="px-4 py-2">
                    {client.isPublic ? (
                      <Badge variant="secondary">Public</Badge>
                    ) : (
                      <Badge variant="muted">Confidential</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {client.grantTypes.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {client.scopes.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatRelative(client.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    <CapabilityGate capability="admin">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(client)}>
                          Edit
                        </Button>
                        {!client.isPublic && (
                          <Button variant="ghost" size="sm" onClick={() => rotate(client)}>
                            Rotate secret
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => remove(client)}>
                          Delete
                        </Button>
                      </div>
                    </CapabilityGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
