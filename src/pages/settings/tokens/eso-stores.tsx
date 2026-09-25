import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  createSecretStore,
  deleteSecretStore,
  getSecretStoreStatus,
  listSecretStores,
  secretStoreProviderKey,
  updateSecretStore,
  SECRET_STORE_PROVIDER_KEYS,
  type CreateSecretStoreInput,
  type SecretStore,
  type SecretStoreProvider,
  type SecretStoreProviderKey,
  type SecretStoreTargets,
  type UpdateSecretStoreInput,
} from "@/api/secret-stores";
import { useAuth } from "@/auth/auth-context";
import { SchemaForm, type SchemaFormHandle } from "@/components/schema-form/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/time";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

const PROVIDER_LABELS: Record<SecretStoreProviderKey, string> = {
  awsSM: "AWS Secrets Manager",
  vault: "HashiCorp Vault",
  gcpsm: "GCP Secret Manager",
  azurekv: "Azure Key Vault",
};

const AUTH_SECRET_REF_SCHEMA: Record<string, unknown> = {
  type: "object",
  title: "Credentials secret reference",
  description:
    "Cluster-side Kubernetes Secret holding the provider credentials. Raw credentials are never accepted or displayed here — the hub stores references only.",
  required: ["name", "namespace"],
  properties: {
    name: { type: "string", title: "Secret name" },
    namespace: { type: "string", title: "Secret namespace" },
  },
};

function providerConfigSchema(key: SecretStoreProviderKey): Record<string, unknown> {
  const base = {
    type: "object",
    title: PROVIDER_LABELS[key],
    required: ["authSecretRef"],
    properties: {} as Record<string, unknown>,
  };
  switch (key) {
    case "awsSM":
      base.required = ["region", "authSecretRef"];
      base.properties = {
        region: { type: "string", title: "Region" },
        authSecretRef: AUTH_SECRET_REF_SCHEMA,
      };
      break;
    case "vault":
      base.required = ["server", "authSecretRef"];
      base.properties = {
        server: { type: "string", title: "Server URL" },
        path: { type: "string", title: "Mount path" },
        authSecretRef: AUTH_SECRET_REF_SCHEMA,
      };
      break;
    case "gcpsm":
      base.required = ["projectId", "authSecretRef"];
      base.properties = {
        projectId: { type: "string", title: "GCP project ID" },
        authSecretRef: AUTH_SECRET_REF_SCHEMA,
      };
      break;
    case "azurekv":
      base.required = ["vaultUrl", "authSecretRef"];
      base.properties = {
        vaultUrl: { type: "string", title: "Vault URL" },
        tenantId: { type: "string", title: "Azure tenant ID" },
        authSecretRef: AUTH_SECRET_REF_SCHEMA,
      };
      break;
  }
  return base;
}

// The provider discriminator is rendered natively by the page (outside RJSF)
// and the schema is rebuilt for the selection, so only the active provider's
// fields render. Form data keeps a UI-only `providerType` plus the selected
// provider's config object; adapters below map this to the contract's keyed
// SecretStoreProvider (exactly one key set).
function buildStoreSchema(
  selected: SecretStoreProviderKey | null,
): Record<string, unknown> {
  return {
    type: "object",
    required: ["name", ...(selected ? [selected] : [])],
    properties: {
      name: {
        type: "string",
        title: "Name",
        pattern: "^[a-z0-9][a-z0-9-]*$",
        description: "Lowercase alphanumeric with dashes.",
      },
      targets: {
        type: "object",
        title: "Targets",
        properties: {
          clusterIds: {
            type: "array",
            title: "Target cluster IDs",
            items: { type: "string" },
            default: [],
          },
          clusterSetRef: { type: "string", title: "Cluster set reference" },
        },
      },
      ...(selected ? { [selected]: providerConfigSchema(selected) } : {}),
    },
  };
}

function toFormData(store: SecretStore): Record<string, unknown> {
  const key = secretStoreProviderKey(store.provider);
  return {
    name: store.name,
    providerType: key ?? undefined,
    ...(key ? { [key]: store.provider[key] } : {}),
    targets: {
      clusterIds: store.targets.clusterIds ?? [],
      clusterSetRef: store.targets.clusterSetRef,
    },
  };
}

function isProviderKey(value: unknown): value is SecretStoreProviderKey {
  return SECRET_STORE_PROVIDER_KEYS.includes(value as SecretStoreProviderKey);
}

function providerFromForm(
  data: Record<string, unknown>,
): SecretStoreProvider | undefined {
  const type = data.providerType;
  if (!isProviderKey(type)) return undefined;
  const config = data[type];
  if (!config || typeof config !== "object") return undefined;
  return { [type]: config } as SecretStoreProvider;
}

function targetsFromForm(data: Record<string, unknown>): SecretStoreTargets {
  const raw = (data.targets ?? {}) as Record<string, unknown>;
  const targets: SecretStoreTargets = {};
  if (Array.isArray(raw.clusterIds)) {
    const ids = (raw.clusterIds as unknown[]).map(String).filter(Boolean);
    if (ids.length > 0) targets.clusterIds = ids;
  }
  if (raw.clusterSetRef) targets.clusterSetRef = String(raw.clusterSetRef);
  return targets;
}

function toCreateInput(data: Record<string, unknown>): CreateSecretStoreInput {
  const provider = providerFromForm(data);
  if (!provider) throw new Error("Select a provider");
  return {
    name: String(data.name ?? ""),
    scope: "cluster",
    provider,
    targets: targetsFromForm(data),
  };
}

function toUpdateInput(data: Record<string, unknown>): UpdateSecretStoreInput {
  return {
    provider: providerFromForm(data),
    targets: targetsFromForm(data),
  };
}

function targetsLabel(store: SecretStore): string {
  const ids = store.targets.clusterIds ?? [];
  if (ids.length > 0) return ids.join(", ");
  return store.targets.clusterSetRef ?? "—";
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
  const ready = status.conditions?.find((c) => c.type === "Ready");
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="warning">pending</Badge>
      {ready?.reason && (
        <span className="text-xs text-muted-foreground">
          {ready.reason}
          {ready.clusterId ? ` (${ready.clusterId})` : ""}
        </span>
      )}
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
    setFormData({ targets: { clusterIds: [] } });
    setEditing("new");
    setActionError(null);
  };

  const openEdit = (store: SecretStore) => {
    setFormData(toFormData(store));
    setEditing(store);
    setActionError(null);
  };

  const submit = async () => {
    const valid = formRef.current?.validate() ?? false;
    if (!selectedProvider) {
      setActionError("Select a provider before saving the secret store.");
      return;
    }
    if (!valid) return;
    setActionError(null);
    try {
      if (editing === "new") {
        await createSecretStore(token, tenant, toCreateInput(formData));
      } else if (editing) {
        await updateSecretStore(token, tenant, editing.name, toUpdateInput(formData));
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

  const selectedProvider = isProviderKey(formData.providerType)
    ? formData.providerType
    : null;

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="ESO secret stores"
        description="External Secrets Operator SecretStore registry. Credentials stay on the cluster as Kubernetes Secrets — the hub stores references only and never displays secret values."
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
            <div className="space-y-1.5">
              <Label htmlFor="secret-store-provider">
                Provider <span className="text-destructive">*</span>
              </Label>
              <select
                id="secret-store-provider"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedProvider ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    providerType: isProviderKey(value) ? value : undefined,
                  }));
                }}
              >
                <option value="">Select…</option>
                {SECRET_STORE_PROVIDER_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PROVIDER_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <SchemaForm
              ref={formRef}
              schema={buildStoreSchema(selectedProvider)}
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
                const providerKey = secretStoreProviderKey(store.provider);
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
                    <td className="px-4 py-2 font-mono text-xs">
                      {providerKey ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {targetsLabel(store)}
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
