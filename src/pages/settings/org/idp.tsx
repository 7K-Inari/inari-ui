import * as React from "react";

import { ApiError } from "@/api/client";
import { useAsyncResource } from "@/api/hooks";
import {
  deleteIdentityProvider,
  exportSpDescriptor,
  getIdentityProvider,
  importIdpMetadata,
  putIdentityProvider,
  rotateProviderSecret,
  uploadIdpCertificate,
  type IdpProvider,
  type IdpProviderInput,
  type IdpProviderKind,
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

// Provider union (M6.W6 reserved, M6.W8 added SAML): the selector is editable
// on create and read-only on edit (a provider's protocol cannot change).
const PROVIDER_FIELD = {
  type: "string",
  title: "Provider type",
  enum: ["oidc", "saml"],
  default: "oidc",
};

const SHARED_FIELDS: Record<string, unknown> = {
  alias: { type: "string", title: "Alias" },
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
};

const NAME_ID_FORMATS = [
  "urn:oasis:names:tc:SAML:1.1:nameid-format:persistent",
  "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
  "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
];

function schemaFor(
  kind: IdpProviderKind,
  isCreate: boolean,
): Record<string, unknown> {
  const provider = { ...PROVIDER_FIELD, default: kind, readOnly: !isCreate };
  if (kind === "saml") {
    // SAML has no discovery URL: fields come from metadata import or manual
    // entry. There is no client secret — trust is via the signing certificate.
    return {
      type: "object",
      required: ["alias", "entityId", "ssoUrl", "claimMapping", "domainHints"],
      properties: {
        provider,
        ...SHARED_FIELDS,
        entityId: { type: "string", title: "Entity ID" },
        ssoUrl: { type: "string", title: "SSO URL", format: "uri" },
        nameIdFormat: {
          type: "string",
          title: "NameID format",
          enum: NAME_ID_FORMATS,
          default: NAME_ID_FORMATS[0],
        },
        signingCertificate: {
          type: "string",
          title: "Signing certificate (PEM)",
        },
        wantAuthnRequestsSigned: {
          type: "boolean",
          title: "Sign authentication requests",
          default: false,
        },
        wantAssertionsSigned: {
          type: "boolean",
          title: "Require signed assertions",
          default: false,
        },
      },
    };
  }
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
      provider,
      ...SHARED_FIELDS,
      issuerUrl: { type: "string", title: "Issuer URL", format: "uri" },
      clientId: { type: "string", title: "Client ID" },
      ...(isCreate
        ? { clientSecret: { type: "string", title: "Client secret" } }
        : {}),
    },
  };
}

// Mask the write-only secret input (matches the rotate form's type=password);
// the certificate PEM is multi-line.
const PROVIDER_UI_SCHEMA = {
  clientSecret: { "ui:widget": "password" as const },
  signingCertificate: { "ui:widget": "textarea" as const },
};

function toInput(data: Record<string, unknown>): IdpProviderInput {
  const claimMapping = (data.claimMapping ?? {}) as Record<string, unknown>;
  const base = {
    alias: String(data.alias ?? ""),
    claimMapping: {
      email: String(claimMapping.email ?? "email"),
      groups: String(claimMapping.groups ?? "groups"),
    },
    domainHints: Array.isArray(data.domainHints)
      ? (data.domainHints as unknown[]).map(String)
      : [],
  };
  if (data.provider === "saml") {
    return {
      ...base,
      provider: "saml",
      entityId: String(data.entityId ?? ""),
      ssoUrl: String(data.ssoUrl ?? ""),
      nameIdFormat: data.nameIdFormat ? String(data.nameIdFormat) : undefined,
      signingCertificate: data.signingCertificate
        ? String(data.signingCertificate)
        : undefined,
      wantAuthnRequestsSigned: Boolean(data.wantAuthnRequestsSigned),
      wantAssertionsSigned: Boolean(data.wantAssertionsSigned),
    };
  }
  return {
    ...base,
    provider: "oidc",
    issuerUrl: String(data.issuerUrl ?? ""),
    clientId: String(data.clientId ?? ""),
    clientSecret: data.clientSecret ? String(data.clientSecret) : undefined,
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
  const [metadataUrl, setMetadataUrl] = React.useState("");
  const [metadataXml, setMetadataXml] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [replacingCert, setReplacingCert] = React.useState(false);
  const [newCertificate, setNewCertificate] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const formRef = React.useRef<SchemaFormHandle>(null);

  const formKind: IdpProviderKind =
    formData.provider === "saml" ? "saml" : "oidc";

  const fail = (err: unknown, fallback: string) =>
    setActionError(err instanceof ApiError ? err.message : fallback);

  const openCreate = () => {
    setFormData({
      provider: "oidc",
      claimMapping: { email: "email", groups: "groups" },
      domainHints: [],
    });
    setMetadataUrl("");
    setMetadataXml("");
    setEditing(true);
    setActionError(null);
    setNotice(null);
  };

  const openEdit = (p: IdpProvider) => {
    setFormData(
      p.provider === "saml"
        ? {
            provider: p.provider,
            alias: p.alias,
            entityId: p.entityId,
            ssoUrl: p.ssoUrl,
            nameIdFormat: p.nameIdFormat,
            signingCertificate: p.signingCertificate,
            wantAuthnRequestsSigned: p.wantAuthnRequestsSigned,
            wantAssertionsSigned: p.wantAssertionsSigned,
            claimMapping: p.claimMapping,
            domainHints: p.domainHints,
          }
        : {
            provider: p.provider,
            alias: p.alias,
            issuerUrl: p.issuerUrl,
            clientId: p.clientId,
            claimMapping: p.claimMapping,
            domainHints: p.domainHints,
          },
    );
    setMetadataUrl("");
    setMetadataXml("");
    setEditing(true);
    setActionError(null);
    setNotice(null);
  };

  const importMetadata = async () => {
    if (!metadataUrl && !metadataXml) return;
    setImporting(true);
    setActionError(null);
    try {
      const config = await importIdpMetadata(token, tenant, {
        metadataUrl: metadataUrl || undefined,
        metadataXml: metadataXml || undefined,
      });
      setFormData((prev) => ({
        ...prev,
        entityId: config.entityId,
        ssoUrl: config.ssoUrl,
        nameIdFormat: config.nameIdFormat ?? prev.nameIdFormat,
        signingCertificate:
          config.signingCertificate ?? prev.signingCertificate,
      }));
      setNotice(
        "Metadata imported — review the prefilled fields before saving.",
      );
    } catch (err) {
      fail(err, "Failed to import metadata");
    } finally {
      setImporting(false);
    }
  };

  const replaceCertificate = async () => {
    if (!newCertificate) return;
    setActionError(null);
    try {
      await uploadIdpCertificate(token, tenant, newCertificate);
      setReplacingCert(false);
      setNewCertificate("");
      setNotice("Certificate updated.");
      refetch();
    } catch (err) {
      fail(err, "Failed to upload certificate");
    }
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

  const downloadSpDescriptor = async () => {
    setActionError(null);
    try {
      const xml = await exportSpDescriptor(token, tenant);
      const url = URL.createObjectURL(
        new Blob([xml], { type: "application/samlmetadata+xml" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tenant}-sp-descriptor.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      fail(err, "Failed to download SP descriptor");
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
        description="Broker sign-in through your organization's identity provider (OIDC or SAML). One provider per organization."
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
            {formKind === "saml" && (
              <div className="space-y-3 rounded-md border border-dashed p-3">
                <p className="text-xs text-muted-foreground">
                  Import IdP metadata to prefill the SAML fields, or enter them
                  manually below.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="idp-metadata-url">Metadata URL</Label>
                  <Input
                    id="idp-metadata-url"
                    value={metadataUrl}
                    onChange={(e) => setMetadataUrl(e.target.value)}
                    placeholder="https://idp.example.org/saml/metadata"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="idp-metadata-xml">Metadata XML</Label>
                  <textarea
                    id="idp-metadata-xml"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
                    value={metadataXml}
                    onChange={(e) => setMetadataXml(e.target.value)}
                    placeholder="<md:EntityDescriptor …>"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={importMetadata}
                  disabled={importing || (!metadataUrl && !metadataXml)}
                >
                  {importing ? "Importing…" : "Import metadata"}
                </Button>
              </div>
            )}
            <SchemaForm
              key={formKind}
              ref={formRef}
              schema={schemaFor(formKind, !provider)}
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
              {provider.provider === "oidc" && provider.secretConfigured && (
                <Badge variant="muted">Secret configured</Badge>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {provider.provider === "oidc" ? (
                <>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Issuer URL
                    </dt>
                    <dd className="font-mono text-xs">{provider.issuerUrl}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Client ID</dt>
                    <dd className="font-mono text-xs">{provider.clientId}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt className="text-xs text-muted-foreground">Entity ID</dt>
                    <dd className="font-mono text-xs">{provider.entityId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">SSO URL</dt>
                    <dd className="font-mono text-xs">{provider.ssoUrl}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      NameID format
                    </dt>
                    <dd className="font-mono text-xs">
                      {provider.nameIdFormat}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Signing certificate
                    </dt>
                    <dd className="text-xs text-muted-foreground">
                      {provider.certExpiresAt
                        ? `Certificate expires ${formatRelative(provider.certExpiresAt)}`
                        : provider.signingCertificate
                          ? "Uploaded (expiry unknown)"
                          : "None uploaded"}
                    </dd>
                  </div>
                </>
              )}
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
            {provider.provider === "saml" && (
              <p className="text-xs text-muted-foreground">
                <button
                  type="button"
                  className="underline"
                  onClick={downloadSpDescriptor}
                >
                  Download SP descriptor
                </button>{" "}
                to hand to your IdP administrator to configure the Inari side.
              </p>
            )}
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
                {provider.provider === "oidc" ? (
                  <Button variant="ghost" size="sm" onClick={confirmRotate}>
                    Rotate secret
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplacingCert(true);
                      setActionError(null);
                      setNotice(null);
                    }}
                  >
                    Replace certificate
                  </Button>
                )}
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

      {replacingCert && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="idp-new-certificate">
                New signing certificate
              </Label>
              <textarea
                id="idp-new-certificate"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
                value={newCertificate}
                onChange={(e) => setNewCertificate(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----"
              />
              <p className="text-xs text-muted-foreground">
                PEM-encoded IdP signing certificate. The previous certificate is
                replaced immediately.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={replaceCertificate} disabled={!newCertificate}>
                Upload
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setReplacingCert(false);
                  setNewCertificate("");
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
