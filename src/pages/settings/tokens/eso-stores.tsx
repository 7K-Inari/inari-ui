import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  createSecretStore,
  deleteSecretStore,
  getSecretStoreStatus,
  listSecretStores,
  updateSecretStore,
  type SecretStore,
  type SecretStoreInput,
  type SecretStoreProviderType,
} from "@/api/secrets";
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
import { useTenant } from "@/tenant/tenant-context";

const STORE_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["name", "provider"],
  properties: {
    name: {
      type: "string",
      title: "Name",
      pattern: "^[a-z0-9][a-z0-9-]*$",
      description: "Lowercase alphanumeric with dashes.",
    },
    clusterIds: {
      type: "array",
      title: "Target cluster IDs",
      items: { type: "string" },
      default: [],
    },
    provider: {
      type: "object",
      title: "Provider",
      required: ["type", "authSecretRef"],
      properties: {
        type: {
          type: "string",
          title: "Provider",
          enum: ["awsSM", "vault", "gcpsm", "azurekv"],
        },
        region: { type: "string", title: "Region" },
        url: { type: "string", title: "Server URL" },
        projectId: { type: "string", title: "GCP project ID" },
        authSecretRef: {
          type: "object",
          title: "Credentials secret reference",
          description:
            "Cluster-side Kubernetes Secret holding the provider credentials. Raw credentials are never accepted here.",
          required: ["name", "namespace"],
          properties: {
            name: { type: "string", title: "Secret name" },
            namespace: { type: "string", title: "Secret namespace" },
          },
        },
      },
    },
  },
};

function toFormData(store: SecretStore): Record<string, unknown> {
  return {
    name: store.name,
    clusterIds: store.clusterIds,
    provider: { ...store.provider },
  };
}

function toInput(data: Record<string, unknown>): SecretStoreInput {
  const provider = (data.provider ?? {}) as Record<string, unknown>;
  const ref = (provider.authSecretRef ?? {}) as Record<string, unknown>;
  const type = String(provider.type ?? "") as SecretStoreProviderType;
  // Keep only the fields relevant to the selected provider type — otherwise
  // switching type on edit leaks stale values (e.g. a vault url onto awsSM).
  const field = (key: string, relevant: boolean) =>
    relevant && provider[key] ? String(provider[key]) : undefined;
  return {
    name: String(data.name ?? ""),
    clusterIds: Array.isArray(data.clusterIds)
      ? (data.clusterIds as unknown[]).map(String)
      : [],
    provider: {
      type,
      region: field("region", type === "awsSM"),
      url: field("url", type === "vault" || type === "azurekv"),
      projectId: field("projectId", type === "gcpsm"),
      authSecretRef: {
        name: String(ref.name ?? ""),
        namespace: String(ref.namespace ?? ""),
      },
    },
  };
}

function StoreStatusBadge({ tenant, name }: { tenant: string; name: string }) {
  const { data: status } = useAsyncResource(
    (t) => getSecretStoreStatus(t, tenant, name),
    [tenant, name],
    { refetchIntervalMs: 10_000 },
  );
  if (!status) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }
  if (status.delivered) {
    return <Badge variant="success">delivered</Badge>;
  }
  const reason = status.conditions.find((c) => c.type === "Ready")?.reason;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="warning">pending</Badge>
      {reason && <span className="text-xs text-muted-foreground">{reason}</span>}
    </span>
  );
}

export function EsoStoresPage() {
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: stores,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => listSecretStores(t, tenant), [tenant]);

  const [editing, setEditing] = React.useState<SecretStore | "new" | null>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [actionError, setActionError] = React.useState<string | null>(null);
  const formRef = React.useRef<SchemaFormHandle>(null);

  const fail = (err: unknown, fallback: string) =>
    setActionError(err instanceof ApiError ? err.message : fallback);

  const openCreate = () => {
    setFormData({ clusterIds: [] });
    setEditing("new");
    setActionError(null);
  };

  const openEdit = (store: SecretStore) => {
    setFormData(toFormData(store));
    setEditing(store);
    setActionError(null);
  };

  const submit = async () => {
    if (!formRef.current?.validate()) return;
    setActionError(null);
    try {
      if (editing === "new") {
        await createSecretStore(token, tenant, toInput(formData));
      } else if (editing) {
        await updateSecretStore(token, tenant, editing.name, toInput(formData));
      }
      setEditing(null);
      refetch();
    } catch (err) {
      fail(err, "Failed to save secret store");
    }
  };

  const remove = async (store: SecretStore) => {
    if (!window.confirm(`Delete secret store "${store.name}"?`)) return;
    setActionError(null);
    try {
      await deleteSecretStore(token, tenant, store.name);
      refetch();
    } catch (err) {
      fail(err, "Failed to delete secret store");
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="ESO secret stores"
        description="External Secrets Operator SecretStore registry. Credentials stay on the cluster as Kubernetes Secrets — the hub stores references only."
        actions={
          <CapabilityGate
            capability="admin"
            fallback={
              <span className="text-xs text-muted-foreground">Read-only (org viewer)</span>
            }
          >
            <Button onClick={() => (editing ? setEditing(null) : openCreate())}>
              {editing ? "Cancel" : "New store"}
            </Button>
          </CapabilityGate>
        }
      />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load secret stores: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !stores && (
        <p className="text-sm text-muted-foreground">Loading secret stores…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {editing && canWriteSettings && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <SchemaForm
              ref={formRef}
              schema={STORE_SCHEMA}
              uiSchema={
                editing !== "new" ? { name: { "ui:disabled": true } } : undefined
              }
              formData={formData}
              onChange={setFormData}
            />
            <Button onClick={submit}>
              {editing === "new" ? "Create store" : "Save store"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && stores && stores.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No secret stores registered for this organization.
          </CardContent>
        </Card>
      )}

      {stores && stores.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Targets</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => {
                const readOnly = store.scope === "platform";
                return (
                  <tr key={store.name} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{store.name}</td>
                    <td className="px-4 py-2">
                      {readOnly ? (
                        <Badge variant="secondary">Platform</Badge>
                      ) : (
                        <Badge variant="muted">Cluster</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{store.provider.type}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {store.clusterIds.join(", ") || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StoreStatusBadge tenant={tenant} name={store.name} />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {formatRelative(store.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      {readOnly ? (
                        <span className="text-xs text-muted-foreground">Read-only</span>
                      ) : (
                        <CapabilityGate capability="admin">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(store)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => remove(store)}>
                              Delete
                            </Button>
                          </div>
                        </CapabilityGate>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
