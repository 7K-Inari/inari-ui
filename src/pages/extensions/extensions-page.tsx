import * as React from "react";

import {
  addUiExtension,
  listBackendExtensions,
  removeUiExtension,
  rotateExtensionIdentity,
  type ExtensionCredentials,
} from "@/api/extensions";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "7k-design-system/react";
import { Button } from "7k-design-system/react";
import { Card } from "7k-design-system/react";
import { Input } from "7k-design-system/react";
import { ApiError } from "@/api/client";
import { checkRemoteEntryHealth } from "@/ext/load-extension";
import { useExtensions, type ExtensionLoadState } from "@/ext/registry";
import { useTenant } from "@/tenant/tenant-context";

const STATE_VARIANT: Record<ExtensionLoadState, "neutral" | "success" | "danger"> = {
  loading: "neutral",
  ready: "success",
  failed: "danger",
};

function AddRemoteForm({ onAdded }: { onAdded: () => void }) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [name, setName] = React.useState("");
  const [remoteEntryUrl, setRemoteEntryUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setNotice(null);
        try {
          // Registration-time health check: reject remoteEntry URLs that are
          // definitively unreachable so stale registrations never get stored.
          // OCI references (not fetchable as remoteEntry.js) and
          // CORS-restricted cross-origin URLs can't be observed — warn and
          // let the server decide instead of hard-failing. Everything else
          // (absolute http(s), root-relative, and bare relative paths, all of
          // which resolveRemoteEntryUrl fetches) is preflighted.
          if (!/^oci:\/\//i.test(remoteEntryUrl)) {
            const health = await checkRemoteEntryHealth(remoteEntryUrl);
            if (health.status === "unhealthy") {
              setError(`${health.error.message} — registration rejected`);
              return;
            }
            if (health.status === "unverifiable") {
              console.warn(`[inari] ${health.reason}`);
              setNotice(
                "remoteEntry reachability could not be verified (CORS-restricted); registering anyway.",
              );
            }
          }
          await addUiExtension(token, tenant, { name, remoteEntryUrl });
          setNotice(null);
          setName("");
          setRemoteEntryUrl("");
          onAdded();
        } catch (err) {
          setError(
            err instanceof ApiError ? err.message : "Failed to add extension remote",
          );
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <label className="form-label" htmlFor="ext-name">Name</label>
        <Input
          id="ext-name"
          value={name}
          onChange={(v) => setName(v)}
          placeholder="inari-ext-argocd"
          required
        />
      </div>
      <div className="min-w-64 space-y-1.5">
        <label className="form-label" htmlFor="ext-entry">remoteEntry URL / OCI reference</label>
        <Input
          id="ext-entry"
          value={remoteEntryUrl}
          onChange={(v) => setRemoteEntryUrl(v)}
          placeholder="/extensions/inari-ext-argocd/remoteEntry.js"
          required
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add remote"}
      </Button>
      {error && (
        <p className="w-full text-sm u-danger" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="w-full text-sm u-muted" role="status">
          {notice}
        </p>
      )}
    </form>
  );
}

export function ExtensionsPage() {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const { entries, reload } = useExtensions();
  const [actionError, setActionError] = React.useState<string | null>(null);

  const backend = useAsyncResource(
    (t) => listBackendExtensions(t, tenant),
    [tenant],
  );
  const [rotateError, setRotateError] = React.useState<string | null>(null);
  const [rotated, setRotated] = React.useState<{
    name: string;
    credentials: ExtensionCredentials;
  } | null>(null);

  // The rotated secret is tenant-scoped and single-use: drop it when the
  // tenant context changes so a stale secret never leaks across tenants.
  React.useEffect(() => {
    setRotated(null);
    setRotateError(null);
  }, [tenant]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header-title">Extensions</h1>
        <p className="text-sm u-muted">
          Installed UI remotes (Module Federation) and backend plugins for this tenant.
        </p>
      </div>

      <Card>
        <div className="card-header">
          <h2 className="mono-label">UI extensions</h2>
        </div>
        <div className="card-body">
          {entries.length === 0 ? (
            <p className="text-sm u-muted">
              No UI extensions installed. Add a remote below.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs u-muted">
                <tr>
                  <th className="py-1 pr-4 font-medium">Name</th>
                  <th className="py-1 pr-4 font-medium">Version</th>
                  <th className="py-1 pr-4 font-medium">Slots</th>
                  <th className="py-1 pr-4 font-medium">State</th>
                  <th className="py-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.remote.name} className="border-t">
                    <td className="py-2 pr-4">
                      <span className="font-medium">
                        {entry.remote.title ?? entry.remote.name}
                      </span>{" "}
                      <span className="font-mono text-xs u-muted">
                        {entry.remote.name}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{entry.remote.version}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {entry.remote.slots.map((s) => (
                          <Badge key={`${s.kind}/${s.name}`} variant="neutral">
                            {s.kind}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={STATE_VARIANT[entry.state]}>{entry.state}</Badge>
                      {entry.errorStatus !== undefined && (
                        <Badge variant="neutral" className="ml-1">
                          HTTP {entry.errorStatus}
                        </Badge>
                      )}
                      {entry.error && (
                        <p className="mt-1 text-xs u-danger">{entry.error}</p>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          setActionError(null);
                          try {
                            await removeUiExtension(token, tenant, entry.remote.name);
                            reload();
                          } catch (err) {
                            setActionError(
                              err instanceof ApiError
                                ? err.message
                                : "Failed to remove extension",
                            );
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {actionError && (
            <p className="text-sm u-danger" role="alert">
              {actionError}
            </p>
          )}
          <AddRemoteForm onAdded={reload} />
        </div>
      </Card>

      <Card>
        <div className="card-header">
          <h2 className="mono-label">Backend extensions</h2>
        </div>
        <div className="card-body">
          {backend.loading && !backend.data ? (
            <p className="text-sm u-muted">Loading backend extensions…</p>
          ) : (backend.data ?? []).length === 0 ? (
            <p className="text-sm u-muted">No backend extensions installed.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs u-muted">
                <tr>
                  <th className="py-1 pr-4 font-medium">Name</th>
                  <th className="py-1 pr-4 font-medium">Version</th>
                  <th className="py-1 pr-4 font-medium">State</th>
                  <th className="py-1 pr-4 font-medium">Health</th>
                  <th className="py-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(backend.data ?? []).map((ext) => (
                  <tr key={ext.id} className="border-t">
                    <td className="py-2 pr-4 font-mono text-xs">{ext.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{ext.version}</td>
                    <td className="py-2 pr-4 font-mono text-xs u-muted">
                      {ext.state}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={ext.healthy ? "success" : "danger"}>
                        {ext.healthy ? "healthy" : "unhealthy"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          setRotateError(null);
                          setRotated(null);
                          try {
                            const credentials = await rotateExtensionIdentity(
                              token,
                              tenant,
                              ext.id,
                            );
                            setRotated({ name: ext.name, credentials });
                          } catch (err) {
                            setRotateError(
                              err instanceof ApiError
                                ? err.message
                                : "Failed to rotate extension identity",
                            );
                          }
                        }}
                      >
                        Rotate identity
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rotateError && (
            <p className="mt-3 text-sm u-danger" role="alert">
              {rotateError}
            </p>
          )}
          {rotated && (
            <div
              className="rounded-md border u-border u-raised/40 p-3 text-sm"
              role="status"
            >
              <p className="font-medium">
                New identity secret for {rotated.name} — shown once, store it now:
              </p>
              <p className="mt-1 font-mono text-xs">
                clientId: {rotated.credentials.clientId}
              </p>
              <p className="font-mono text-xs">
                secret: {rotated.credentials.secret}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
