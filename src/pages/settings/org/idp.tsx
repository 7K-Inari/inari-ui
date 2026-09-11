import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  deleteIdentityProvider,
  getIdentityProvider,
  putIdentityProvider,
  rotateProviderSecret,
  type IdpProvider,
  type IdpProviderInput,
} from "@/api/idp";
import { useAuth } from "@/auth/auth-context";
import {
  SchemaForm,
  type SchemaFormHandle,
} from "@/components/schema-form/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/time";
import {
  CapabilityGate,
  useOrgCapabilities,
} from "@/pages/settings/components/capability-gate";
import { SettingsSectionHeader } from "@/pages/settings/components/section-header";
import { useTenant } from "@/tenant/tenant-context";

// Base schema shared by create and edit. `provider` is a const union member so
// SAML can be added later without redesign; the select is pinned to OIDC in v1.
const PROVIDER_BASE_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["alias", "issuerUrl", "clientId", "claimMapping", "domainHints"],
  properties: {
    provider: {
      type: "string",
      title: "Provider type",
      enum: ["oidc"],
      default: "oidc",
      readOnly: true,
    },
    alias: { type: "string", title: "Alias" },
    issuerUrl: { type: "string", title: "Issuer URL", format: "uri" },
    clientId: { type: "string", title: "Client ID" },
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

// clientSecret is write-only and only accepted on create.
const PROVIDER_CREATE_SCHEMA: Record<string, unknown> = {
  ...PROVIDER_BASE_SCHEMA,
  required: [...(PROVIDER_BASE_SCHEMA.required as string[]), "clientSecret"],
  properties: {
    ...(PROVIDER_BASE_SCHEMA.properties as Record<string, unknown>),
    clientSecret: { type: "string", title: "Client secret" },
  },
};

// Mask the write-only secret input (matches the rotate form's type=password).
const PROVIDER_UI_SCHEMA = {
  clientSecret: { "ui:widget": "password" as const },
};

function toInput(data: Record<string, unknown>): IdpProviderInput {
  const claimMapping = (data.claimMapping ?? {}) as Record<string, unknown>;
  return {
    provider: "oidc",
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
      provider: "oidc",
      claimMapping: { email: "email", groups: "groups" },
      domainHints: [],
    });
    setEditing(true);
    setActionError(null);
    setNotice(null);
  };

  const openEdit = (p: IdpProvider) => {
    setFormData({
      provider: p.provider,
      alias: p.alias,
      issuerUrl: p.issuerUrl,
      clientId: p.clientId,
      claimMapping: p.claimMapping,
      domainHints: p.domainHints,
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
      !window.confirm(
        "Delete the SSO provider? Users will no longer be routed to it at login.",
      )
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

  const confirmRotate = () => {
    if (
      window.confirm(
        "Rotate the client secret? The old secret stops working immediately.",
      )
    ) {
      setRotating(true);
      setActionError(null);
      setNotice(null);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="SSO provider"
        description="Broker sign-in through your organization's identity provider (OIDC). One provider per organization."
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
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load SSO provider: {error.message}
          </CardContent>
        </Card>
      )}

      {!error && loading && !provider && (
        <p className="text-sm text-muted-foreground">Loading SSO provider…</p>
      )}

      {actionError && (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">
            {actionError}
          </CardContent>
        </Card>
      )}

      {notice && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">
            {notice}
          </CardContent>
        </Card>
      )}

      {editing && canWriteSettings && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <SchemaForm
              ref={formRef}
              schema={provider ? PROVIDER_BASE_SCHEMA : PROVIDER_CREATE_SCHEMA}
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
          </CardContent>
        </Card>
      )}

      {!error && !loading && !provider && !editing && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No SSO provider configured for this organization.
          </CardContent>
        </Card>
      )}

      {provider && !editing && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{provider.alias}</span>
              <Badge variant="secondary">
                {provider.provider.toUpperCase()}
              </Badge>
              {provider.secretConfigured && (
                <Badge variant="muted">Secret configured</Badge>
              )}
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
                  email: {provider.claimMapping.email}, groups:{" "}
                  {provider.claimMapping.groups}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Updated</dt>
                <dd className="text-xs text-muted-foreground">
                  {formatRelative(provider.updatedAt)}
                </dd>
              </div>
            </dl>
            <div>
              <dt className="text-xs text-muted-foreground">Domain hints</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {provider.domainHints.length === 0 && (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
                {provider.domainHints.map((d) => (
                  <Badge key={d} variant="secondary">
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
          </CardContent>
        </Card>
      )}

      {rotating && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="idp-new-secret">New client secret</Label>
              <Input
                id="idp-new-secret"
                type="password"
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
