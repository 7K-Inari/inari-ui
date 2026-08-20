import * as React from "react";

import {
  addUiExtension,
  listBackendExtensions,
  removeUiExtension,
} from "@/api/extensions";
import { useAsyncResource } from "@/api/hooks";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/api/client";
import { useExtensions, type ExtensionLoadState } from "@/ext/registry";
import { useTenant } from "@/tenant/tenant-context";

const STATE_VARIANT: Record<ExtensionLoadState, "secondary" | "success" | "destructive"> = {
  loading: "secondary",
  ready: "success",
  failed: "destructive",
};

function AddRemoteForm({ onAdded }: { onAdded: () => void }) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [name, setName] = React.useState("");
  const [remoteEntryUrl, setRemoteEntryUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
          await addUiExtension(token, tenant, { name, remoteEntryUrl });
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
        <Label htmlFor="ext-name">Name</Label>
        <Input
          id="ext-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="inari-ext-argocd"
          required
        />
      </div>
      <div className="min-w-64 space-y-1.5">
        <Label htmlFor="ext-entry">remoteEntry URL / OCI reference</Label>
        <Input
          id="ext-entry"
          value={remoteEntryUrl}
          onChange={(e) => setRemoteEntryUrl(e.target.value)}
          placeholder="/extensions/inari-ext-argocd/remoteEntry.js"
          required
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add remote"}
      </Button>
      {error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Extensions</h1>
        <p className="text-sm text-muted-foreground">
          Installed UI remotes (Module Federation) and backend plugins for this tenant.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">UI extensions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No UI extensions installed. Add a remote below.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
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
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.remote.name}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{entry.remote.version}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {entry.remote.slots.map((s) => (
                          <Badge key={`${s.kind}/${s.name}`} variant="outline">
                            {s.kind}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={STATE_VARIANT[entry.state]}>{entry.state}</Badge>
                      {entry.error && (
                        <p className="mt-1 text-xs text-destructive">{entry.error}</p>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="outline"
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
            <p className="text-sm text-destructive" role="alert">
              {actionError}
            </p>
          )}
          <AddRemoteForm onAdded={reload} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backend extensions</CardTitle>
        </CardHeader>
        <CardContent>
          {backend.loading && !backend.data ? (
            <p className="text-sm text-muted-foreground">Loading backend extensions…</p>
          ) : (backend.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No backend extensions installed.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 font-medium">Name</th>
                  <th className="py-1 pr-4 font-medium">Version</th>
                  <th className="py-1 pr-4 font-medium">Description</th>
                  <th className="py-1 font-medium">Health</th>
                </tr>
              </thead>
              <tbody>
                {(backend.data ?? []).map((ext) => (
                  <tr key={ext.name} className="border-t">
                    <td className="py-2 pr-4 font-mono text-xs">{ext.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{ext.version}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{ext.description}</td>
                    <td className="py-2">
                      <Badge variant={ext.healthy ? "success" : "destructive"}>
                        {ext.healthy ? "healthy" : "unhealthy"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
