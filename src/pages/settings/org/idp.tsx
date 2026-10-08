import * as React from "react";
import { useConfirm } from "@/components/confirm";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  deleteIdentityProvider,
  getIdentityProvider,
  putIdentityProvider,
  rotateProviderSecret,
  type OidcProvider,
  type OidcProviderInput,
} from "@/api/idp";
import { useAuth } from "@/auth/auth-context";
import {
  SchemaForm,
  type SchemaFormHandle,
} from "@/components/schema-form/schema-form";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
import { formatRelative } from "@/lib/time";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

function schemaFor(isCreate: boolean): Record<string, unknown> {
  const required = [
    "alias",
    "issuerUrl",
    "clientId",
    "claimMapping",
    "domainHints",
  ];
  // clientSecret is write-only and only accepted on create.
  if (isCreate) required.push("clientSecret");
  return {
    type: "object",
    required,
    properties: {
      alias: { type: "string", title: "Alias" },
      issuerUrl: { type: "string", title: "Issuer URL", format: "uri" },
      clientId: { type: "string", title: "Client ID" },
      ...(isCreate
        ? { clientSecret: { type: "string", title: "Client secret" } }
        : {}),
      claimMapping: {
        type: "object",
        title: "Claim mapping",
        required: ["email", "groups"],
        properties: {
          email: { type: "string", title: "Email claim", default: "email" },
          groups: { type: "string", title: "Groups claim", default: "groups" },
        },
      },
      domainHints: {
        type: "array",
        title: "Domain hints (login routing)",
        description:
          "Tenant email domains routed to this provider at login. Exact (acme.example) or wildcard (*.acme.example).",
        items: {
          type: "string",
          pattern:
            "^(\\*\\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$",
        },
        default: [],
      },
    },
  };
}

// Mask the write-only secret input (matches the rotate form's type=password).
const PROVIDER_UI_SCHEMA = {
  clientSecret: { "ui:widget": "password" as const },
};

function toInput(data: Record<string, unknown>): OidcProviderInput {
  const claimMapping = (data.claimMapping ?? {}) as Record<string, unknown>;
  return {
    alias: String(data.alias ?? ""),
    issuerUrl: String(data.issuerUrl ?? ""),
    clientId: String(data.clientId ?? ""),
    clientSecret: data.clientSecret ? String(data.clientSecret) : undefined,
    claimMapping: {
      email: String(claimMapping.email ?? "email"),
      groups: String(claimMapping.groups ?? "groups"),
    },
    domainHints: Array.isArray(data.domainHints)
      ? (data.domainHints as unknown[]).map(String)
      : [],
  };
}

export function IdpBrokeringPage() {
  const [confirm, confirmDialog] = useConfirm();
  const { tenant } = useTenant();
  const { token } = useAuth();
  const { canWriteSettings } = useOrgCapabilities();
  const {
    data: provider,
    loading,
    error,
    refetch,
  } = useAsyncResource((t) => getIdentityProvider(t, tenant), [tenant]);

  const [editing, setEditing] = React.useState(false);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [rotating, setRotating] = React.useState(false);
  const [newSecret, setNewSecret] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const formRef = React.useRef<SchemaFormHandle>(null);

  const fail = (err: unknown, fallback: string) =>
    setActionError(err instanceof ApiError ? err.message : fallback);

  const openCreate = () => {
    setFormData({
      claimMapping: { email: "email", groups: "groups" },
      domainHints: [],
    });
    setEditing(true);
    setActionError(null);
    setNotice(null);
  };

  const openEdit = (p: OidcProvider) => {
    setFormData({
      alias: p.alias,
      issuerUrl: p.issuerUrl,
      clientId: p.clientId,
      claimMapping: p.claimMapping,
      domainHints: p.domainHints ?? [],
    });
    setEditing(true);
    setActionError(null);
    setNotice(null);
  };

  const submit = async () => {
    if (!formRef.current?.validate()) return;
    setActionError(null);
    try {
      await putIdentityProvider(token, tenant, toInput(formData));
      setEditing(false);
      refetch();
    } catch (err) {
      fail(err, "Failed to save provider");
    }
  };

  const rotate = async () => {
    if (!newSecret) return;
    setActionError(null);
    try {
      await rotateProviderSecret(token, tenant, newSecret);
      setRotating(false);
      setNewSecret("");
      setNotice("Secret rotated.");
      refetch();
    } catch (err) {
      fail(err, "Failed to rotate secret");
    }
  };

  const remove = async () => {
    if (
      !(await confirm({
        title: "Delete SSO provider",
        body: "Delete the SSO provider? Users will no longer be routed to it at login.",
        confirmLabel: "Delete",
      }))
    ) {
      return;
    }
    setActionError(null);
    setNotice(null);
    try {
      await deleteIdentityProvider(token, tenant);
      refetch();
    } catch (err) {
      fail(err, "Failed to delete provider");
    }
  };

  const confirmRotate = async () => {
    if (
      await confirm({
        title: "Rotate client secret",
        body: "Rotate the client secret? The old secret stops working immediately.",
        confirmLabel: "Rotate",
      })
    ) {
      setRotating(true);
      setActionError(null);
      setNotice(null);
    }
  };

  const domainHints = provider?.domainHints ?? [];

  return (
    <div className="space-y-4">
      {confirmDialog}
      <SettingsSectionHeader
        title="SSO provider"
        description="Broker sign-in through your organization's OIDC identity provider. One provider per organization."
        actions={
          <CapabilityGate
            capability="admin"
            fallback={
              <span className="text-xs text-muted-foreground">
                Read-only (org viewer)
              </span>
            }
          >
            {!provider && !editing && (
              <Button onClick={openCreate}>Configure provider</Button>
            )}
          </CapabilityGate>
        }
      />

      {error && (
        <Card>
          <div className="card-body">
            Failed to load SSO provider: {error.message}
          </div>
        </Card>
      )}

      {!error && loading && !provider && (
        <p className="text-sm text-muted-foreground">Loading SSO provider…</p>
      )}

      {actionError && (
        <Card>
          <div className="card-body">
            {actionError}
          </div>
        </Card>
      )}

      {notice && (
        <Card>
          <div className="card-body">
            {notice}
          </div>
        </Card>
      )}

      {editing && canWriteSettings && (
        <Card>
          <div className="card-body">
            <SchemaForm
              ref={formRef}
              schema={schemaFor(!provider)}
              uiSchema={PROVIDER_UI_SCHEMA}
              formData={formData}
              onChange={setFormData}
            />
            <div className="flex gap-2">
              <Button onClick={submit}>Save provider</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!error && !loading && !provider && !editing && (
        <Card>
          <div className="card-body">
            No SSO provider configured for this organization.
          </div>
        </Card>
      )}

      {provider && !editing && (
        <Card>
          <div className="card-body">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{provider.alias}</span>
              <Badge variant="neutral">OIDC</Badge>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Issuer URL</dt>
                <dd className="font-mono text-xs">{provider.issuerUrl}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Client ID</dt>
                <dd className="font-mono text-xs">{provider.clientId}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Claim mapping</dt>
                <dd className="font-mono text-xs">
                  email: {provider.claimMapping.email ?? "email"}, groups:{" "}
                  {provider.claimMapping.groups ?? "groups"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd className="text-xs text-muted-foreground">
                  {formatRelative(provider.createdAt)}
                </dd>
              </div>
            </dl>
            <div>
              <dt className="text-xs text-muted-foreground">Domain hints</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {domainHints.length === 0 && (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
                {domainHints.map((d) => (
                  <Badge key={d} variant="neutral">
                    {d}
                  </Badge>
                ))}
              </dd>
            </div>
            <CapabilityGate capability="admin">
              <div className="flex gap-1 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(provider)}
                >
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={confirmRotate}>
                  Rotate secret
                </Button>
                <Button variant="ghost" size="sm" onClick={remove}>
                  Delete
                </Button>
              </div>
            </CapabilityGate>
          </div>
        </Card>
      )}

      {rotating && (
        <Card>
          <div className="card-body">
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="idp-new-secret">New client secret</label>
              <Input
                id="idp-new-secret"
                type="password"
                value={newSecret}
                onChange={(v) => setNewSecret(v)}
              />
              <p className="text-xs text-muted-foreground">
                The secret is write-only and will not be shown again.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={rotate} disabled={!newSecret}>
                Rotate
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRotating(false);
                  setNewSecret("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
